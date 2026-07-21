import { z } from "zod";

const yearMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected YYYY-MM");

export const candidateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  targetRoles: z.array(z.string().min(1)).default([]),
});

export const experienceSchema = z.object({
  id: z.string().min(1),
  organization: z.string().min(1),
  role: z.string().min(1),
  location: z.string().default(""),
  startDate: yearMonthSchema,
  endDate: z.union([yearMonthSchema, z.literal("present")]),
});

export const bulletStatusSchema = z.enum(["draft", "approved", "archived"]);

export const bulletSchema = z.object({
  id: z.string().min(1),
  achievementId: z.string().min(1).optional(),
  experienceId: z.string().min(1),
  projectName: z.string().min(1).optional(),
  groupId: z.string().min(1).optional(),
  groupName: z.string().min(1).optional(),
  groupOrder: z.number().int().nonnegative().optional(),
  text: z.string().min(1),
  status: bulletStatusSchema,
  skills: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
});

export const bulletBankSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    candidate: candidateSchema,
    experiences: z.array(experienceSchema).min(1),
    bullets: z.array(bulletSchema).min(1),
  })
  .superRefine((bank, context) => {
    const experienceIds = new Set<string>();
    for (const [index, experience] of bank.experiences.entries()) {
      if (experienceIds.has(experience.id)) {
        context.addIssue({
          code: "custom",
          path: ["experiences", index, "id"],
          message: `Duplicate experience ID: ${experience.id}`,
        });
      }
      experienceIds.add(experience.id);
    }

    const bulletIds = new Set<string>();
    for (const [index, bullet] of bank.bullets.entries()) {
      if (bulletIds.has(bullet.id)) {
        context.addIssue({
          code: "custom",
          path: ["bullets", index, "id"],
          message: `Duplicate bullet ID: ${bullet.id}`,
        });
      }
      bulletIds.add(bullet.id);

      if (!experienceIds.has(bullet.experienceId)) {
        context.addIssue({
          code: "custom",
          path: ["bullets", index, "experienceId"],
          message: `Unknown experience ID: ${bullet.experienceId}`,
        });
      }
    }
  });

export const contactSchema = z.object({
  location: z.string().min(1),
  phone: z.string().min(1),
  email: z.email(),
  linkedIn: z.url(),
  github: z.url(),
  languages: z.array(z.string().min(1)).default([]),
});

export const skillSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  keywords: z.array(z.string().min(1)).default([]),
});

export const educationSchema = z.object({
  degree: z.string().min(1),
  institution: z.string().min(1),
  location: z.string().default(""),
  graduationDate: z.string().min(1),
  details: z.string().optional(),
});

export const academicProjectSchema = z.object({
  name: z.string().min(1),
  affiliation: z.string().min(1),
  startDate: yearMonthSchema,
  endDate: yearMonthSchema,
  bullets: z.array(z.string().min(1)).min(1),
});

export const resumeProfileSchema = z.object({
  headline: z.string().min(1),
  contact: contactSchema,
  skillCatalog: z.array(skillSchema).min(1),
  academicProjects: z.array(academicProjectSchema).default([]),
  education: z.array(educationSchema).default([]),
  certificationsAndAwards: z.array(z.string().min(1)).default([]),
});

export type BulletBank = z.infer<typeof bulletBankSchema>;
export type Bullet = z.infer<typeof bulletSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type ResumeProfile = z.infer<typeof resumeProfileSchema>;
export type Skill = z.infer<typeof skillSchema>;

