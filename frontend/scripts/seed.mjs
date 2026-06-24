// One-off: seed a few demo issues into Firestore so the map looks alive.
// Run from the frontend dir:  node scripts/seed.mjs
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAsM_4jTozH94SbELV-AZb9pNAb_WmEZi0",
  authDomain: "junkcivicsense.firebaseapp.com",
  projectId: "junkcivicsense",
  storageBucket: "junkcivicsense.firebasestorage.app",
  messagingSenderId: "469094181917",
  appId: "1:469094181917:web:43551e8b32d37fe905eaf4",
};

const db = getFirestore(initializeApp(firebaseConfig));
const TINY =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const issues = [
  { title: "Open manhole near school gate", category: "sewage", severity: "critical", desc: "An uncovered manhole near a school gate — serious danger to children.", lat: 12.9352, lng: 77.6245, addr: "Koramangala, Bengaluru", count: 3 },
  { title: "Massive pothole on Outer Ring Road", category: "pothole", severity: "high", desc: "A large pothole on ORR causing traffic and accidents.", lat: 12.935, lng: 77.624, addr: "Outer Ring Road, Bengaluru", count: 1 },
  { title: "Overflowing garbage near market", category: "garbage", severity: "medium", desc: "Garbage piling up near the market for over a week.", lat: 12.9719, lng: 77.6412, addr: "Indiranagar, Bengaluru", count: 2 },
  { title: "Streetlight out on 12th Main", category: "streetlight", severity: "medium", desc: "Streetlight not working; the area is pitch dark at night.", lat: 12.925, lng: 77.583, addr: "Jayanagar, Bengaluru", count: 1 },
  { title: "Water pipeline burst, road flooded", category: "water_leakage", severity: "high", desc: "A burst pipeline has flooded the road.", lat: 12.9784, lng: 77.6408, addr: "Whitefield, Bengaluru", count: 1 },
];

async function main() {
  const existing = await getDocs(collection(db, "issues"));
  if (!existing.empty) {
    console.log(`Firestore already has ${existing.size} issue(s) — skipping seed.`);
    process.exit(0);
  }
  for (const i of issues) {
    await addDoc(collection(db, "issues"), {
      title: i.title,
      description: i.desc,
      category: i.category,
      severity: i.severity,
      confidence: 0.8,
      status: "reported",
      location: { lat: i.lat, lng: i.lng, address: i.addr, city: "Bengaluru" },
      imageData: TINY,
      afterImageData: null,
      reporterId: "seed",
      reporterName: "Demo Citizen",
      corroborators: [],
      reportCount: i.count,
      complaintDraft: null,
      resolvedBy: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      resolvedAt: null,
    });
    console.log("seeded:", i.title);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((e) => {
  console.error("SEED FAILED:", e.message);
  process.exit(1);
});
