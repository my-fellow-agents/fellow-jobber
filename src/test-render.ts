import { loadBulletBank, loadResumeProfile } from "./data/load.js";
import { createBalancedResumeSelection } from "./resume/balanced-selection.js";
import { renderResumeLatex } from "./resume/latex.js";

const jobDescription = `
We are hiring an AI Engineer to build production-grade agentic systems,
multi-agent workflows, agent-to-agent communication, and graph-based
retrieval-augmented generation applications. The candidate should have
experience with Python, LangGraph, Neo4j, AWS, Terraform, CI/CD,
evaluation, observability, and production deployment.
`;

const [bulletBank, profile] = await Promise.all([
  loadBulletBank(),
  loadResumeProfile(),
]);

const selection = createBalancedResumeSelection(
  jobDescription,
  bulletBank,
  profile,
);

console.log("\nBalanced résumé selection:");

for (const section of selection.sections) {
  const heading = section.groupName
    ? `${section.organization} - ${section.groupName}`
    : section.organization;

  console.log(`\n${heading}`);

  for (const bullet of section.bullets) {
    console.log(
      `  ${bullet.id} | ${bullet.selectionType} | score=${bullet.score}`,
    );
  }
}

const result = await renderResumeLatex({
  selectedBulletIds: selection.selectedBulletIds,
  selectedSkillNames: selection.selectedSkillNames,
  outputName: "balanced-tailored-resume",
});

console.log("\nRendered résumé:");
console.log(result);
