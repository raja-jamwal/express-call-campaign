import 'dotenv/config';
import { faker } from '@faker-js/faker';
import { prisma } from '../src/lib/prisma';

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data in reverse dependency order
  console.log('🗑️  Clearing existing data...');
  await prisma.call_logs.deleteMany();
  await prisma.call_tasks.deleteMany();
  await prisma.call_campaigns.deleteMany();
  await prisma.call_schedules.deleteMany();
  await prisma.phone_numbers.deleteMany();
  await prisma.users.deleteMany();

  // Create User (single user)
  console.log('👥 Creating user...');
  const user = await prisma.users.create({
    data: {
      name: 'Raja Jamwal',
      email: 'linux.experi@gmail.com',
    },
  });
  console.log(`✅ Created user: ${user.name} (${user.email})`);

  // Create Phone Numbers (100+)
  console.log('📱 Creating phone numbers...');
  const phoneNumbers = [];
  const phoneCount = faker.number.int({ min: 100, max: 150 });
  for (let i = 0; i < phoneCount; i++) {
    const phoneNumber = await prisma.phone_numbers.create({
      data: {
        user_id: user.id,
        number: `+1${faker.string.numeric(10)}`,
        status: faker.helpers.arrayElement(['valid', 'valid', 'valid', 'invalid', 'do_not_call']),
      },
    });
    phoneNumbers.push(phoneNumber);
  }
  console.log(`✅ Created ${phoneNumbers.length} phone numbers`);

  // Create Call Schedules
  console.log('📅 Creating call schedules...');
  const schedules = [];
  const scheduleCount = faker.number.int({ min: 5, max: 10 });
  for (let i = 0; i < scheduleCount; i++) {
    const schedule = await prisma.call_schedules.create({
      data: {
        user_id: user.id,
        name: faker.helpers.arrayElement([
          'Business Hours',
          'Morning Shift',
          'Evening Shift',
          'Weekend Schedule',
          'All Day Schedule',
        ]) + ` - ${faker.location.city()}`,
        time_zone: faker.helpers.arrayElement([
          'America/New_York',
          'America/Chicago',
          'America/Denver',
          'America/Los_Angeles',
          'America/Phoenix',
        ]),
        schedule_rules: {
          days: faker.helpers.arrayElements(
            ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
            { min: 3, max: 7 }
          ),
          start_time: '09:00',
          end_time: '17:00',
          exclude_holidays: faker.datatype.boolean(),
        },
      },
    });
    schedules.push(schedule);
  }
  console.log(`✅ Created ${schedules.length} call schedules`);

  // Create Call Campaigns (100+)
  console.log('📢 Creating call campaigns...');
  const campaigns = [];

  const campaignCount = faker.number.int({ min: 100, max: 150 });
  for (let i = 0; i < campaignCount; i++) {
    const totalTasks = faker.number.int({ min: 10, max: 50 });
    const completedTasks = faker.number.int({ min: 0, max: totalTasks });
    const failedTasks = faker.number.int({ min: 0, max: totalTasks - completedTasks });

    const campaign = await prisma.call_campaigns.create({
      data: {
        user_id: user.id,
        name: faker.helpers.arrayElement([
          'Customer Outreach',
          'Sales Campaign',
          'Follow-up Calls',
          'Survey Campaign',
          'Appointment Reminders',
          'Product Launch',
          'Holiday Promotion',
          'Lead Generation',
        ]) + ` - ${faker.company.name()}`,
        is_paused: faker.datatype.boolean(),
        schedule_id: faker.helpers.arrayElement(schedules).id,
        max_concurrent_calls: faker.number.int({ min: 3, max: 10 }),
        max_retries: faker.number.int({ min: 1, max: 5 }),
        retry_delay_seconds: faker.helpers.arrayElement([60, 120, 300, 600, 900]),
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        failed_tasks: failedTasks,
        retries_attempted: faker.number.int({ min: 0, max: failedTasks * 2 }),
      },
    });
    campaigns.push(campaign);
  }
  console.log(`✅ Created ${campaigns.length} call campaigns`);

  // Create Call Tasks
  console.log('📞 Creating call tasks...');
  const callTasks = [];
  const taskStatuses: Array<'pending' | 'in_progress' | 'completed' | 'failed'> = [
    'pending',
    'in_progress',
    'completed',
    'failed',
  ];

  for (const campaign of campaigns) {
    const userPhoneNumbers = phoneNumbers.filter((pn) => pn.user_id === campaign.user_id && pn.status === 'valid');
    
    if (userPhoneNumbers.length === 0) continue;

    const taskCount = Math.min(campaign.total_tasks, faker.number.int({ min: 5, max: 15 }));
    const selectedPhones = faker.helpers.arrayElements(userPhoneNumbers, Math.min(taskCount, userPhoneNumbers.length));

    for (let i = 0; i < selectedPhones.length; i++) {
      try {
        const task = await prisma.call_tasks.create({
          data: {
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            phone_number_id: selectedPhones[i].id,
            status: faker.helpers.arrayElement(taskStatuses),
            scheduled_at: faker.date.between({
              from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              to: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }),
            retry_count: faker.number.int({ min: 0, max: 3 }),
          },
        });
        callTasks.push(task);
      } catch (error) {
        // Skip if unique constraint fails (campaign_id, phone_number_id already exists)
        continue;
      }
    }
  }
  console.log(`✅ Created ${callTasks.length} call tasks`);

  // Create Call Logs
  console.log('📋 Creating call logs...');
  const callLogStatuses: Array<'initiated' | 'in_progress' | 'completed' | 'failed'> = [
    'initiated',
    'in_progress',
    'completed',
    'failed',
  ];

  let callLogsCount = 0;
  for (const task of callTasks) {
    // Create logs for completed or failed tasks
    if (task.status === 'completed' || task.status === 'failed') {
      const logsToCreate = faker.number.int({ min: 1, max: task.retry_count + 1 });

      for (let i = 0; i < logsToCreate; i++) {
        const phoneNumber = phoneNumbers.find((pn) => pn.id === task.phone_number_id);
        if (!phoneNumber) continue;

        const logStatus = faker.helpers.arrayElement(callLogStatuses);
        const startedAt = faker.date.between({
          from: new Date(task.scheduled_at.getTime() - 3600000),
          to: task.scheduled_at,
        });
        const endedAt = logStatus === 'completed' || logStatus === 'failed'
          ? new Date(startedAt.getTime() + faker.number.int({ min: 30000, max: 1800000 })) // 30s to 30min
          : null;

        await prisma.call_logs.create({
          data: {
            user_id: task.user_id,
            call_task_id: task.id,
            phone_number_id: task.phone_number_id,
            dialed_number: phoneNumber.number,
            external_call_id: `call_${faker.string.alphanumeric(24)}`,
            status: logStatus,
            failure_reason: logStatus === 'failed'
              ? faker.helpers.arrayElement([
                  'No answer',
                  'Busy',
                  'Invalid number',
                  'Network error',
                  'Call rejected',
                  'Voicemail',
                ])
              : null,
            started_at: startedAt,
            ended_at: endedAt,
          },
        });
        callLogsCount++;
      }
    }
  }
  console.log(`✅ Created ${callLogsCount} call logs`);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - User: ${user.name} (${user.email})`);
  console.log(`   - Phone Numbers: ${phoneNumbers.length}`);
  console.log(`   - Call Schedules: ${schedules.length}`);
  console.log(`   - Call Campaigns: ${campaigns.length}`);
  console.log(`   - Call Tasks: ${callTasks.length}`);
  console.log(`   - Call Logs: ${callLogsCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

