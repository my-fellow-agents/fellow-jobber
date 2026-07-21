import { FunctionTool } from "@google/adk";
import { z } from "zod";
import { loadBulletBank, loadResumeProfile } from "../data/load.js";
import { createResumeContext } from "../resume/planner.js";

export async function getResumeContext(jobDescription: string) {
  const [bulletBank, profile] = await Promise.all([
    loadBulletBank(),
    loadResumeProfile(),
  ]);

  const context = createResumeContext(
    jobDescription,
    bulletBank,
    profile,
  );

  return {
    status: "success",
    candidateBullets: context.candidateBullets,
    candidateSkills: context.candidateSkills,
    selectionRules: {
      bullets: [
        "Select only bullet IDs returned by this tool.",
        "Prefer bullets with higher relevance scores.",
        "Use at most one variant from the same achievement.",
        "Select bullets from multiple relevant experiences when possible.",
        "Do not rewrite or invent bullet text."
      ],
      skills: [
        "Select only skills returned by this tool.",
        "Prefer skills explicitly requested by the job description.",
        "Do not add technologies that are absent from the allowlist."
      ]
    }
  };
}

const parameters = z.object({
  jobDescription: z
    .string()
    .min(20)
    .describe("The complete job description used to tailor the resume.")
});

export const getResumeContextTool = new FunctionTool({
  name: "get_resume_context",
  description:
    "Searches the private bullet bank and skill catalog for resume content relevant to a job description. Returns approved bullet IDs and allowlisted skills. Call this before creating a resume.",
  parameters,
  execute: async ({ jobDescription }) =>
    getResumeContext(jobDescription)
});
