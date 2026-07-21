import { loadBulletBank, loadResumeProfile } from "./data/load.js";

const bulletBank = await loadBulletBank();
const profile = await loadResumeProfile();

console.log("Data validation successful");
console.log(`Experiences: ${bulletBank.experiences.length}`);
console.log(`Bullets: ${bulletBank.bullets.length}`);
console.log(`Allowed skills: ${profile.skillCatalog.length}`);
console.log(`Academic projects: ${profile.academicProjects.length}`);
