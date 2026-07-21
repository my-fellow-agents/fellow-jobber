import { getResumeContext } from "./tools/get-resume-context.js";

const sampleJobDescription = `
We are looking for an AI Engineer to build production-grade agentic
systems and retrieval-augmented generation applications. The candidate
should have strong Python and FastAPI experience and practical knowledge
of LangGraph, vector databases, Neo4j, AWS, Kubernetes, Terraform,
evaluation, observability, and CI/CD.
`;

const result = await getResumeContext(sampleJobDescription);

console.log("\nTop matching bullets:");

for (const bullet of result.candidateBullets.slice(0, 10)) {
  console.log(
    `${bullet.id} | score=${bullet.score} | ${bullet.text}`
  );
}

console.log("\nMatching skills:");

for (const skill of result.candidateSkills) {
  console.log(
    `${skill.category} | ${skill.name} | score=${skill.score}`
  );
}
