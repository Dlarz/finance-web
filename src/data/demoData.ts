import { addDays, addMonths, isoWeekday, startOfMonth, toISODate, parseISODate, type Clock, type ISODate } from '../domain/dates';
import type { Language } from '../i18n/types';
import { newId, type FinanceDB } from './db';
import { runRecurringEngine } from './recurringEngine';
import { ensureTags } from './tagsRepo';
import { writeSettings } from './settingsRepo';
import type { Category, RecurringRule, Transaction, TxType } from './types';

/** Small deterministic PRNG so the demo data is the same every time. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoTx {
  type: TxType;
  categoryKey: string;
  amount: number;
  date: ISODate;
  comment: string;
  tags: string[];
}

const TEXT_DE = {
    rent: 'Miete',
    salary: 'Lohn',
    phone: 'Swisscom Handy-Abo',
    streaming: 'Netflix',
    gym: 'Fitnessabo',
    weeklyShop: 'Wocheneinkauf',
    smallShop: 'Kleiner Einkauf',
    bakery: 'Bäckerei',
    lunch: 'Mittagessen',
    dinner: 'Abendessen mit Freunden',
    takeaway: 'Take-away',
    coffee: 'Kaffee & Gipfeli',
    train: 'SBB Tageskarte',
    bus: 'Busbillett',
    fuel: 'Tanken',
    parking: 'Parkhaus',
    pharmacy: 'Apotheke',
    doctor: 'Arztbesuch Selbstbehalt',
    book: 'Fachbuch',
    course: 'Sprachkurs',
    clothes: 'Kleider',
    electronics: 'Kopfhörer',
    cinema: 'Kino',
    concert: 'Konzert',
    weekendTrip: 'Wochenende im Tessin',
    hotel: 'Hotel Zermatt',
    haircut: 'Coiffeur',
    present: 'Geburtstagsgeschenk',
    sideJob: 'Babysitting',
    freelance: 'Website für Nachbarn',
    giftIn: 'Geschenk von Grosi',
    dividend: 'Dividende',
    electricity: 'Stromrechnung',
    insurance: 'Krankenkasse',
};

type DemoText = typeof TEXT_DE;

const TEXT: Record<Language, DemoText> = {
  de: TEXT_DE,
  en: {
    rent: 'Rent',
    salary: 'Salary',
    phone: 'Swisscom mobile plan',
    streaming: 'Netflix',
    gym: 'Gym membership',
    weeklyShop: 'Weekly groceries',
    smallShop: 'Quick shop',
    bakery: 'Bakery',
    lunch: 'Lunch',
    dinner: 'Dinner with friends',
    takeaway: 'Take-away',
    coffee: 'Coffee & croissant',
    train: 'SBB day pass',
    bus: 'Bus ticket',
    fuel: 'Fuel',
    parking: 'Parking garage',
    pharmacy: 'Pharmacy',
    doctor: "Doctor's visit deductible",
    book: 'Textbook',
    course: 'Language course',
    clothes: 'Clothes',
    electronics: 'Headphones',
    cinema: 'Cinema',
    concert: 'Concert',
    weekendTrip: 'Weekend in Ticino',
    hotel: 'Hotel Zermatt',
    haircut: 'Hairdresser',
    present: 'Birthday present',
    sideJob: 'Babysitting',
    freelance: 'Website for the neighbours',
    giftIn: 'Gift from grandma',
    dividend: 'Dividend',
    electricity: 'Electricity bill',
    insurance: 'Health insurance',
  },
};

/** Loads about 6 months of realistic Swiss demo data. Only allowed while there are no transactions. */
export async function loadDemoData(db: FinanceDB, clock: Clock, language: Language): Promise<void> {
  const count = await db.transactions.count();
  if (count > 0) throw new Error('not-empty');
  const t = TEXT[language];
  const today = clock.today();
  const rand = mulberry32(20260930);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const chf = (units: number) => units * 100;

  const categories = await db.categories.toArray();
  const catId = (key: string): string => {
    const iconByKey: Record<string, [TxType, string]> = {
      groceries: ['EXPENSE', 'shopping_cart'],
      restaurants: ['EXPENSE', 'restaurant'],
      transport: ['EXPENSE', 'directions_bus'],
      car: ['EXPENSE', 'directions_car'],
      housing: ['EXPENSE', 'home'],
      bills: ['EXPENSE', 'receipt_long'],
      health: ['EXPENSE', 'favorite'],
      education: ['EXPENSE', 'school'],
      shopping: ['EXPENSE', 'shopping_bag'],
      entertainment: ['EXPENSE', 'movie'],
      travel: ['EXPENSE', 'flight'],
      subscriptions: ['EXPENSE', 'autorenew'],
      other: ['EXPENSE', 'category'],
      salary: ['INCOME', 'payments'],
      side_job: ['INCOME', 'handyman'],
      gifts: ['INCOME', 'card_giftcard'],
      investments: ['INCOME', 'trending_up'],
    };
    const [type, icon] = iconByKey[key]!;
    const found = categories.find((c: Category) => c.type === type && c.iconKey === icon) ?? categories.find((c) => c.type === type && c.isDefaultOther);
    if (!found) throw new Error(`demo category missing: ${key}`);
    return found.id;
  };

  const start = startOfMonth(addMonths(today, -5));
  const list: DemoTx[] = [];
  const add = (type: TxType, categoryKey: string, amount: number, date: ISODate, comment: string, tags: string[] = []) => {
    if (date <= today && date >= start) list.push({ type, categoryKey, amount, date, comment, tags });
  };

  for (let d = start; d <= today; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    const { d: dom } = parseISODate(d);
    // groceries: big shop on Saturday, small shops during the week
    if (wd === 6) add('EXPENSE', 'groceries', chf(between(85, 160)) + between(0, 95), d, t.weeklyShop, [pick(['coop', 'migros'])]);
    else if (rand() < 0.38) add('EXPENSE', 'groceries', chf(between(8, 45)) + between(0, 95), d, pick([t.smallShop, t.bakery, t.smallShop]), [pick(['coop', 'migros', 'denner', 'aldi'])]);
    // eating out
    if (wd <= 5 && rand() < 0.3) add('EXPENSE', 'restaurants', chf(between(14, 28)) + between(0, 95), d, t.lunch, ['lunch']);
    if (wd >= 5 && rand() < 0.35) add('EXPENSE', 'restaurants', chf(between(38, 95)), d, pick([t.dinner, t.takeaway]), ['friends']);
    if (rand() < 0.15) add('EXPENSE', 'restaurants', chf(between(5, 9)) + between(0, 95), d, t.coffee, []);
    // transport
    if (wd <= 5 && rand() < 0.12) add('EXPENSE', 'transport', chf(between(4, 12)) + between(0, 95), d, t.bus, ['sbb']);
    if (rand() < 0.06) add('EXPENSE', 'transport', chf(between(45, 75)), d, t.train, ['sbb', 'halbtax']);
    if (rand() < 0.05) add('EXPENSE', 'car', chf(between(60, 95)) + between(0, 95), d, t.fuel, ['auto']);
    if (rand() < 0.04) add('EXPENSE', 'car', chf(between(6, 24)), d, t.parking, ['auto']);
    // occasional
    if (rand() < 0.04) add('EXPENSE', 'health', chf(between(12, 60)) + between(0, 95), d, t.pharmacy, ['apotheke']);
    if (rand() < 0.05) add('EXPENSE', 'shopping', chf(between(29, 180)), d, t.clothes, [pick(['zalando', 'h&m', 'manor'])]);
    if (rand() < 0.04) add('EXPENSE', 'entertainment', chf(between(18, 45)), d, t.cinema, ['weekend']);
    if (rand() < 0.02) add('EXPENSE', 'education', chf(between(35, 90)), d, t.book, []);
    if (rand() < 0.03) add('EXPENSE', 'other', chf(between(15, 70)), d, t.haircut, []);
    // month-based
    if (dom === 12) add('EXPENSE', 'health', 41500, d, t.insurance, ['krankenkasse']);
    if (dom === 20 && rand() < 0.5) add('EXPENSE', 'bills', chf(between(70, 140)), d, t.electricity, []);
    if (dom === 8 && rand() < 0.5) add('INCOME', 'side_job', chf(between(120, 380)), d, t.sideJob, ['nebenjob']);
  }
  // a few bigger one-offs
  add('EXPENSE', 'travel', 48600, addDays(today, -42), t.weekendTrip, ['tessin', 'weekend']);
  add('EXPENSE', 'travel', 38900, addDays(today, -110), t.hotel, ['ferien']);
  add('EXPENSE', 'shopping', 24900, addDays(today, -23), t.electronics, ['digitec']);
  add('EXPENSE', 'education', 69000, addDays(today, -95), t.course, ['migros klubschule']);
  add('EXPENSE', 'entertainment', 11800, addDays(today, -60), t.concert, ['friends']);
  add('EXPENSE', 'shopping', 7900, addDays(today, -12), t.present, ['geschenk']);
  add('INCOME', 'side_job', 120000, addDays(today, -75), t.freelance, ['freelance']);
  add('INCOME', 'gifts', 20000, addDays(today, -33), t.giftIn, ['geschenk']);
  add('INCOME', 'investments', 14250, addDays(today, -50), t.dividend, ['dividende']);

  const now = clock.now();
  await db.transaction('rw', [db.transactions, db.tags, db.transactionTags, db.recurringRules, db.settings], async () => {
    let i = 0;
    for (const item of list) {
      const createdAt = now - (list.length - i) * 60_000;
      const tx: Transaction = {
        id: newId(),
        type: item.type,
        amount: item.amount,
        categoryId: catId(item.categoryKey),
        date: item.date,
        comment: item.comment,
        createdAt,
        updatedAt: createdAt,
      };
      await db.transactions.add(tx);
      const tagIds = await ensureTags(db, item.tags);
      if (tagIds.length) await db.transactionTags.bulkAdd(tagIds.map((tagId) => ({ transactionId: tx.id, tagId })));
      i++;
    }
    const { y, m } = parseISODate(start);
    const rules: Array<Omit<RecurringRule, 'id' | 'tagIds' | 'createdAt' | 'updatedAt' | 'isPaused' | 'generateFrom'> & { tags: string[] }> = [
      { type: 'EXPENSE', amount: chf(1650), categoryId: catId('housing'), comment: t.rent, frequency: 'MONTHLY', interval: 1, startDate: toISODate(y, m, 1), endDate: null, tags: ['miete'] },
      { type: 'INCOME', amount: chf(5800), categoryId: catId('salary'), comment: t.salary, frequency: 'MONTHLY', interval: 1, startDate: toISODate(y, m, 25), endDate: null, tags: [] },
      { type: 'EXPENSE', amount: 6500, categoryId: catId('bills'), comment: t.phone, frequency: 'MONTHLY', interval: 1, startDate: toISODate(y, m, 10), endDate: null, tags: ['swisscom'] },
      { type: 'EXPENSE', amount: 1790, categoryId: catId('subscriptions'), comment: t.streaming, frequency: 'MONTHLY', interval: 1, startDate: toISODate(y, m, 15), endDate: null, tags: ['abo'] },
      { type: 'EXPENSE', amount: 8900, categoryId: catId('health'), comment: t.gym, frequency: 'MONTHLY', interval: 1, startDate: toISODate(y, m, 5), endDate: null, tags: ['abo'] },
    ];
    for (const r of rules) {
      const { tags, ...rest } = r;
      const tagIds = await ensureTags(db, tags);
      await db.recurringRules.add({ ...rest, id: newId(), tagIds, isPaused: false, generateFrom: rest.startDate, createdAt: now, updatedAt: now });
    }
    await writeSettings(db, { startingBalance: 320000, firstUseAt: now - 180 * 86_400_000 });
  });
  await runRecurringEngine(db, clock);
}
