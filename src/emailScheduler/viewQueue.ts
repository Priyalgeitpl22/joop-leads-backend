import { emailQueue } from "./queue";

async function viewQueue() {
  console.log("\n📬 EMAIL QUEUE STATUS\n");

  const waiting = await emailQueue.getWaiting();
  const active = await emailQueue.getActive();
  const completed = await emailQueue.getCompleted();
  const failed = await emailQueue.getFailed();
  const delayed = await emailQueue.getDelayed();

  console.log(`⏳ Waiting:   ${waiting.length}`);
  console.log(`🔄 Active:    ${active.length}`);
  console.log(`✅ Completed: ${completed.length}`);
  console.log(`❌ Failed:    ${failed.length}`);
  console.log(`⏰ Delayed:   ${delayed.length}`);

  if (waiting.length > 0) {
    console.log("\n--- Waiting Jobs ---");
    waiting.forEach((job) => {
      console.log(`  ID: ${job.id}, Data:`, job.data);
    });
  }

  if (active.length > 0) {
    console.log("\n--- Active Jobs ---");
    active.forEach((job) => {
      console.log(`  ID: ${job.id}, Data:`, job.data);
    });
  }

  if (failed.length > 0) {
    console.log("\n--- Failed Jobs ---");
    failed.forEach((job) => {
      console.log(`  ID: ${job.id}, Error: ${job.failedReason}, Data:`, job.data);
    });
  }

  process.exit(0);
}

viewQueue().catch(console.error);

