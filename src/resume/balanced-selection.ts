import type {
  Bullet,
  BulletBank,
  Experience,
  ResumeProfile,
} from "../data/schema.js";
import {
  createResumeContext,
  type RankedBullet,
} from "./planner.js";

export interface SelectedSectionBullet extends RankedBullet {
  selectionType: "relevant" | "filler";
}

export interface SelectedResumeSection {
  experienceId: string;
  organization: string;
  role: string;
  groupId?: string;
  groupName?: string;
  groupOrder: number;
  minimumBullets: number;
  maximumBullets: number;
  bullets: SelectedSectionBullet[];
}

export interface BalancedResumeSelection {
  selectedBulletIds: string[];
  selectedSkillNames: string[];
  sections: SelectedResumeSection[];
}

interface SectionPolicy {
  minimumBullets: number;
  maximumBullets: number;
}

const DEFAULT_EXPERIENCE_POLICY: SectionPolicy = {
  minimumBullets: 2,
  maximumBullets: 3,
};

const GROUP_POLICIES: Record<string, SectionPolicy> = {
  cgi_agentic_ai: {
    minimumBullets: 3,
    maximumBullets: 5,
  },
  cgi_nlp_mlops: {
    minimumBullets: 3,
    maximumBullets: 5,
  },
};

function chronologicalValue(experience: Experience): string {
  return experience.endDate === "present"
    ? "9999-12"
    : experience.endDate;
}

function getPolicy(groupId?: string): SectionPolicy {
  if (groupId && GROUP_POLICIES[groupId]) {
    return GROUP_POLICIES[groupId];
  }

  return DEFAULT_EXPERIENCE_POLICY;
}

function achievementKey(bullet: Bullet): string {
  return bullet.achievementId ?? bullet.id;
}

function sectionKey(bullet: Bullet): string {
  return `${bullet.experienceId}:${bullet.groupId ?? "default"}`;
}

export function createBalancedResumeSelection(
  jobDescription: string,
  bank: BulletBank,
  profile: ResumeProfile,
  maximumSkills = 14,
): BalancedResumeSelection {
  const context = createResumeContext(
    jobDescription,
    bank,
    profile,
    bank.bullets.length,
    profile.skillCatalog.length,
  );

  const rankedById = new Map(
    context.candidateBullets.map((bullet) => [
      bullet.id,
      bullet,
    ]),
  );

  const approvedBullets = bank.bullets.filter(
    (bullet) => bullet.status === "approved",
  );

  const experienceById = new Map(
    bank.experiences.map((experience) => [
      experience.id,
      experience,
    ]),
  );

  const bulletsBySection = new Map<string, Bullet[]>();

  for (const bullet of approvedBullets) {
    const key = sectionKey(bullet);
    const existing = bulletsBySection.get(key) ?? [];

    existing.push(bullet);
    bulletsBySection.set(key, existing);
  }

  const usedAchievements = new Set<string>();
  const sections: SelectedResumeSection[] = [];

  for (const sectionBullets of bulletsBySection.values()) {
    const firstBullet = sectionBullets[0];

    if (!firstBullet) {
      continue;
    }

    const experience = experienceById.get(
      firstBullet.experienceId,
    );

    if (!experience) {
      throw new Error(
        `Unknown experience: ${firstBullet.experienceId}`,
      );
    }

    const policy = getPolicy(firstBullet.groupId);

    const rankedSectionBullets = sectionBullets
      .map((bullet) => {
        const ranked = rankedById.get(bullet.id);

        if (!ranked) {
          throw new Error(
            `Bullet was not ranked: ${bullet.id}`,
          );
        }

        return {
          source: bullet,
          ranked,
        };
      })
      .sort(
        (left, right) =>
          right.ranked.score - left.ranked.score ||
          left.ranked.id.localeCompare(right.ranked.id),
      );

    const uniqueCandidates = rankedSectionBullets.filter(
      ({ source }) => {
        const key = achievementKey(source);

        if (usedAchievements.has(key)) {
          return false;
        }

        usedAchievements.add(key);
        return true;
      },
    );

    const relevantCount = uniqueCandidates.filter(
      ({ ranked }) => ranked.score > 0,
    ).length;

    const targetCount = Math.min(
      policy.maximumBullets,
      Math.max(policy.minimumBullets, relevantCount),
      uniqueCandidates.length,
    );

    const selected = uniqueCandidates
      .slice(0, targetCount)
      .map(({ ranked }) => ({
        ...ranked,
        selectionType:
          ranked.score > 0
            ? ("relevant" as const)
            : ("filler" as const),
      }));

    sections.push({
      experienceId: experience.id,
      organization: experience.organization,
      role: experience.role,
      ...(firstBullet.groupId
        ? { groupId: firstBullet.groupId }
        : {}),
      ...(firstBullet.groupName
        ? { groupName: firstBullet.groupName }
        : {}),
      groupOrder: firstBullet.groupOrder ?? 0,
      minimumBullets: policy.minimumBullets,
      maximumBullets: policy.maximumBullets,
      bullets: selected,
    });
  }

  sections.sort((left, right) => {
    const leftExperience = experienceById.get(
      left.experienceId,
    );
    const rightExperience = experienceById.get(
      right.experienceId,
    );

    if (!leftExperience || !rightExperience) {
      return 0;
    }

    const chronologicalComparison =
      chronologicalValue(rightExperience).localeCompare(
        chronologicalValue(leftExperience),
      );

    if (chronologicalComparison !== 0) {
      return chronologicalComparison;
    }

    return left.groupOrder - right.groupOrder;
  });

  return {
    selectedBulletIds: sections.flatMap((section) =>
      section.bullets.map((bullet) => bullet.id),
    ),
    selectedSkillNames: context.candidateSkills
      .slice(0, maximumSkills)
      .map((skill) => skill.name),
    sections,
  };
}
