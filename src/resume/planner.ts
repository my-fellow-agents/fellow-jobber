import type {
  Bullet,
  BulletBank,
  Experience,
  ResumeProfile,
  Skill,
} from "../data/schema.js";

export interface RankedBullet {
  id: string;
  experienceId: string;
  text: string;
  skills: string[];
  tags: string[];
  score: number;
  matchedTerms: string[];
}

export interface RankedSkill {
  name: string;
  category: string;
  score: number;
  matchedTerms: string[];
}

export interface ResumeContext {
  jobDescription: string;
  candidateBullets: RankedBullet[];
  candidateSkills: RankedSkill[];
}

export interface PlannedExperience {
  experience: Experience;
  bullets: Bullet[];
}

export interface PlannedSkillCategory {
  category: string;
  skills: string[];
}

export interface ResumePlan {
  experiences: PlannedExperience[];
  skillCategories: PlannedSkillCategory[];
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "to",
  "we",
  "will",
  "with",
  "you",
  "your",
]);

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();
}

function tokenize(value: string): Set<string> {
  const terms = normalize(value)
    .split(/\s+/)
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  return new Set(terms);
}

function findMatches(
  jobTerms: Set<string>,
  candidateText: string,
): string[] {
  const candidateTerms = tokenize(candidateText);

  return [...candidateTerms].filter((term) => jobTerms.has(term));
}

function phraseAppears(jobDescription: string, phrase: string): boolean {
  return normalize(jobDescription).includes(normalize(phrase));
}

function rankBullet(
  jobDescription: string,
  jobTerms: Set<string>,
  bullet: Bullet,
): RankedBullet {
  const searchableText = [
    bullet.text,
    ...bullet.skills,
    ...bullet.tags,
  ].join(" ");

  const matchedTerms = findMatches(jobTerms, searchableText);

  const skillBonus = bullet.skills.reduce(
    (score, skill) =>
      score + (phraseAppears(jobDescription, skill) ? 4 : 0),
    0,
  );

  const tagBonus = bullet.tags.reduce(
    (score, tag) =>
      score + (phraseAppears(jobDescription, tag) ? 2 : 0),
    0,
  );

  return {
    id: bullet.id,
    experienceId: bullet.experienceId,
    text: bullet.text,
    skills: bullet.skills,
    tags: bullet.tags,
    score: matchedTerms.length + skillBonus + tagBonus,
    matchedTerms,
  };
}

function rankSkill(
  jobDescription: string,
  jobTerms: Set<string>,
  skill: Skill,
): RankedSkill {
  const searchableText = [skill.name, ...skill.keywords].join(" ");
  const matchedTerms = findMatches(jobTerms, searchableText);

  const nameBonus = phraseAppears(jobDescription, skill.name) ? 6 : 0;
  const keywordBonus = skill.keywords.reduce(
    (score, keyword) =>
      score + (phraseAppears(jobDescription, keyword) ? 3 : 0),
    0,
  );

  return {
    name: skill.name,
    category: skill.category,
    score: matchedTerms.length + nameBonus + keywordBonus,
    matchedTerms,
  };
}

export function createResumeContext(
  jobDescription: string,
  bank: BulletBank,
  profile: ResumeProfile,
  maximumBullets = Number.MAX_SAFE_INTEGER,
  maximumSkills = 20,
): ResumeContext {
  if (jobDescription.trim().length < 20) {
    throw new Error("The job description is too short to analyze.");
  }

  const jobTerms = tokenize(jobDescription);

  const rankedBullets = bank.bullets
    .filter((bullet) => bullet.status === "approved")
    .map((bullet) => rankBullet(jobDescription, jobTerms, bullet))
    .sort(
      (left, right) =>
        right.score - left.score || left.id.localeCompare(right.id),
    )
    .slice(0, maximumBullets);

  const rankedSkills = profile.skillCatalog
    .map((skill) => rankSkill(jobDescription, jobTerms, skill))
    .filter((skill) => skill.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.name.localeCompare(right.name),
    )
    .slice(0, maximumSkills);

  return {
    jobDescription,
    candidateBullets: rankedBullets,
    candidateSkills: rankedSkills,
  };
}

function chronologicalValue(experience: Experience): string {
  if (experience.endDate === "present") {
    return "9999-12";
  }

  return experience.endDate;
}

export function buildResumePlan(
  bank: BulletBank,
  profile: ResumeProfile,
  selectedBulletIds: string[],
  selectedSkillNames: string[],
): ResumePlan {
  const bulletById = new Map(
    bank.bullets.map((bullet) => [bullet.id, bullet]),
  );

  const skillByName = new Map(
    profile.skillCatalog.map((skill) => [
      skill.name.toLowerCase(),
      skill,
    ]),
  );

  const selectedBullets: Bullet[] = [];
  const usedBulletIds = new Set<string>();
  const usedAchievementIds = new Set<string>();

  for (const bulletId of selectedBulletIds) {
    if (usedBulletIds.has(bulletId)) {
      continue;
    }

    const bullet = bulletById.get(bulletId);

    if (!bullet) {
      throw new Error(`Unknown bullet ID: ${bulletId}`);
    }

    if (bullet.status !== "approved") {
      throw new Error(`Bullet is not approved: ${bulletId}`);
    }

    if (
      bullet.achievementId &&
      usedAchievementIds.has(bullet.achievementId)
    ) {
      continue;
    }

    usedBulletIds.add(bulletId);

    if (bullet.achievementId) {
      usedAchievementIds.add(bullet.achievementId);
    }

    selectedBullets.push(bullet);
  }

  const experienceById = new Map(
    bank.experiences.map((experience) => [
      experience.id,
      experience,
    ]),
  );

  const bulletsByExperience = new Map<string, Bullet[]>();

  for (const bullet of selectedBullets) {
    const existing = bulletsByExperience.get(bullet.experienceId) ?? [];
    existing.push(bullet);
    bulletsByExperience.set(bullet.experienceId, existing);
  }

  const experiences: PlannedExperience[] = [];

  for (const [experienceId, bullets] of bulletsByExperience) {
    const experience = experienceById.get(experienceId);

    if (!experience) {
      throw new Error(`Unknown experience ID: ${experienceId}`);
    }

    experiences.push({ experience, bullets });
  }

  experiences.sort((left, right) =>
    chronologicalValue(right.experience).localeCompare(
      chronologicalValue(left.experience),
    ),
  );

  const skillsByCategory = new Map<string, string[]>();

  for (const selectedName of selectedSkillNames) {
    const skill = skillByName.get(selectedName.toLowerCase());

    if (!skill) {
      throw new Error(`Unknown skill: ${selectedName}`);
    }

    const categorySkills = skillsByCategory.get(skill.category) ?? [];

    if (!categorySkills.includes(skill.name)) {
      categorySkills.push(skill.name);
    }

    skillsByCategory.set(skill.category, categorySkills);
  }

  const skillCategories = [...skillsByCategory.entries()].map(
    ([category, skills]) => ({ category, skills }),
  );

  return {
    experiences,
    skillCategories,
  };
}

