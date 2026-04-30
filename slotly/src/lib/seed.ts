import { db } from "./db";
import bcrypt from "bcryptjs";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@slotly.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

const businesses: Array<{
  name: string;
  category: string;
  neighborhood: string;
  address: string;
  phone: string;
  whatsapp?: string;
  price_level: number;
  tags: string;
}> = [
  { name: "Trattoria da Enzo al 29", category: "restaurant", neighborhood: "Trastevere", address: "Via dei Vascellari 29", phone: "+39 06 581 2260", price_level: 2, tags: "romantic,traditional,roman" },
  { name: "Roscioli", category: "restaurant", neighborhood: "Centro", address: "Via dei Giubbonari 21", phone: "+39 06 687 5287", price_level: 3, tags: "wine,foodie,date" },
  { name: "Pizzarium Bonci", category: "restaurant", neighborhood: "Prati", address: "Via della Meloria 43", phone: "+39 06 3974 5416", price_level: 1, tags: "casual,pizza,quick" },
  { name: "Salotto 42", category: "bar", neighborhood: "Centro", address: "Piazza di Pietra 42", phone: "+39 06 678 5804", whatsapp: "+39 333 111 2222", price_level: 3, tags: "aperitivo,chic,cocktails" },
  { name: "Freni e Frizioni", category: "bar", neighborhood: "Trastevere", address: "Via del Politeama 4-6", phone: "+39 06 4549 7499", price_level: 2, tags: "aperitivo,buffet,lively" },
  { name: "Shari Vari Playhouse", category: "nightlife", neighborhood: "Centro", address: "Via di Torre Argentina 78", phone: "+39 06 686 4577", whatsapp: "+39 333 222 3333", price_level: 3, tags: "club,guestlist,table" },
  { name: "Goa Club", category: "nightlife", neighborhood: "Ostiense", address: "Via Giuseppe Libetta 13", phone: "+39 06 574 8277", price_level: 3, tags: "techno,late,club" },
  { name: "Barberia Migliore", category: "salon", neighborhood: "Prati", address: "Via Cola di Rienzo 156", phone: "+39 06 321 1234", whatsapp: "+39 333 333 4444", price_level: 2, tags: "barber,classic,walkin" },
  { name: "Studio Hair Trastevere", category: "salon", neighborhood: "Trastevere", address: "Vicolo del Cinque 12", phone: "+39 06 580 9988", price_level: 2, tags: "salon,women,color" },
  { name: "CrossFit Roma Nord", category: "fitness", neighborhood: "Prati", address: "Via Andrea Doria 41", phone: "+39 06 372 8899", price_level: 2, tags: "crossfit,classes,dropin" },
  { name: "Roma BJJ Academy", category: "fitness", neighborhood: "Centro", address: "Via Cavour 200", phone: "+39 06 444 5566", whatsapp: "+39 333 555 6666", price_level: 2, tags: "bjj,martialarts,classes" },
  { name: "QC Termeroma Spa", category: "fitness", neighborhood: "Fiumicino", address: "Via Pontina km 27.500", phone: "+39 06 9826 5601", price_level: 4, tags: "spa,wellness,couples" },
];

function seedBusinesses() {
  const exists = db.prepare("SELECT COUNT(*) as c FROM businesses").get() as { c: number };
  if (exists.c > 0) {
    console.log(`Businesses already seeded (${exists.c}). Skipping.`);
    return;
  }
  const stmt = db.prepare(
    `INSERT INTO businesses (name, category, neighborhood, address, phone, whatsapp, price_level, tags)
     VALUES (@name, @category, @neighborhood, @address, @phone, @whatsapp, @price_level, @tags)`,
  );
  const tx = db.transaction(() => {
    for (const b of businesses) stmt.run({ whatsapp: null, ...b });
  });
  tx();
  console.log(`Seeded ${businesses.length} businesses.`);
}

async function seedAdmin() {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(ADMIN_EMAIL);
  if (existing) {
    console.log(`Admin ${ADMIN_EMAIL} already exists.`);
    return;
  }
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  db.prepare(
    `INSERT INTO users (email, password_hash, first_name, role) VALUES (?, ?, ?, 'admin')`,
  ).run(ADMIN_EMAIL, hash, "Admin");
  console.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

async function main() {
  seedBusinesses();
  await seedAdmin();
  console.log("Seed complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
