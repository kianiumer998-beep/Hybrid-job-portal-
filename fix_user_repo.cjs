const fs = require('fs');
let content = fs.readFileSync('server/db/repositories/UserRepository.ts', 'utf8');

const replacement = `static async syncDemoAdminAsync(): Promise<void> {
    if (!isMongoConfigured()) throw new Error("MongoDB must be configured in production");

    const coll = await getUsersCollection();
    const adminEmail = 'admin@jobportal.com';
    const existing = await coll.findOne({ email: adminEmail });

    const adminHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'; // sha256 of admin123
    const adminSalt = 'dev-salt';

    if (!existing) {
      const canonicalAdmin = {
        id: 'user-demo-admin-1',
        name: 'Super Administrator',
        email: adminEmail,
        username: 'admin',
        passwordHash: adminHash,
        salt: adminSalt,
        role: 'Super Admin',
        permissions: ['all'],
        plan: 'Premium',
        walletBalance: 100000,
        membershipStatus: 'Active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await coll.insertOne(canonicalAdmin);
      console.log('[UserRepository] Canonical demo admin created in MongoDB.');
    } else {
      const updates = {
        passwordHash: adminHash,
        salt: adminSalt,
        role: 'Super Admin',
        permissions: ['all'],
        updatedAt: new Date().toISOString()
      };
      await coll.updateOne({ email: adminEmail }, { $set: updates });
      console.log('[UserRepository] Demo admin credentials synchronized in MongoDB.');
    }
  }`;

const regex = /static async syncDemoAdminAsync\(\): Promise<void> \{[\s\S]*?\}\s*catch[^{]*\{[^}]*\}\s*\}/;
content = content.replace(regex, replacement);

fs.writeFileSync('server/db/repositories/UserRepository.ts', content);
console.log("Replaced user repo");
