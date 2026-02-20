import { MyDb } from "./schema";

export const db = new MyDb();

db.open().catch((err)=>{
    console.error('Failed to open indexedDB:', err.stack || err);
});

export const resetDatabase = async () => {
  await db.delete().catch((err) => {
    console.error("database deletion falied : ", err);
    
  });
  await db.open().catch((err)=>{
    console.error('Failed to open indexedDB:', err.stack || err);
    });
};
