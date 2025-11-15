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

  // Create Phone Numbers (need enough for campaigns)
  console.log('📱 Creating phone numbers...');
  const phoneNumbers = [];
  const phoneCount = 500; // Create enough phone numbers for multiple campaigns (100+ tasks each)
  for (let i = 0; i < phoneCount; i++) {
    const phoneNumber = await prisma.phone_numbers.create({
      data: {
        user_id: user.id,
        number: `+1${faker.string.numeric(10)}`,
        status: 'valid', // Ensure all are valid for campaign tasks
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
  const TASKS_PER_CAMPAIGN = 100; // Fixed number of tasks per campaign

  const campaignCount = faker.number.int({ min: 100, max: 150 });
  
  for (let i = 0; i < campaignCount; i++) {
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
        is_paused: true,
        schedule_id: faker.helpers.arrayElement(schedules).id,
        max_concurrent_calls: faker.number.int({ min: 3, max: 10 }),
        max_retries: faker.number.int({ min: 1, max: 5 }),
        retry_delay_seconds: faker.helpers.arrayElement([60, 120, 300, 600, 900]),
        total_tasks: TASKS_PER_CAMPAIGN,
        completed_tasks: 0,
        failed_tasks: 0,
        retries_attempted: 0,
      },
    });
    campaigns.push(campaign);
  }
  console.log(`✅ Created ${campaigns.length} call campaigns`);

  // Create Call Tasks
  console.log('📞 Creating call tasks...');
  const callTasks = [];
  const validPhoneNumbers = phoneNumbers.filter((pn) => pn.user_id === user.id && pn.status === 'valid');

  for (const campaign of campaigns) {
    if (validPhoneNumbers.length < TASKS_PER_CAMPAIGN) {
      console.warn(`⚠️  Not enough phone numbers for campaign ${campaign.id}. Skipping...`);
      continue;
    }

    // Select 100 unique phone numbers for this campaign
    const selectedPhones = faker.helpers.arrayElements(validPhoneNumbers, TASKS_PER_CAMPAIGN);

    for (const phoneNumber of selectedPhones) {
      try {
        const task = await prisma.call_tasks.create({
          data: {
            user_id: campaign.user_id,
            campaign_id: campaign.id,
            phone_number_id: phoneNumber.id,
            status: 'pending',
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
        console.warn(`⚠️  Duplicate phone number for campaign ${campaign.id}, skipping...`);
        continue;
      }
    }
  }
  console.log(`✅ Created ${callTasks.length} call tasks`);

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - User: ${user.name} (${user.email})`);
  console.log(`   - Phone Numbers: ${phoneNumbers.length}`);
  console.log(`   - Call Schedules: ${schedules.length}`);
  console.log(`   - Call Campaigns: ${campaigns.length}`);
  console.log(`   - Call Tasks: ${callTasks.length}`);
  // console.log(`   - Call Logs: ${callLogsCount}`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

