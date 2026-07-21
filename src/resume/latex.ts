import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { loadBulletBank, loadResumeProfile } from "../data/load.js";
import {
  buildResumePlan,
  type PlannedExperience,
  type PlannedSkillCategory,
} from "./planner.js";
import type {
  ResumeProfile,
} from "../data/schema.js";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sept",
  "Oct",
  "Nov",
  "Dec",
];

const LATEX_REPLACEMENTS: Record<string, string> = {
  "\\": String.raw`\textbackslash{}`,
  "{": String.raw`\{`,
  "}": String.raw`\}`,
  "$": String.raw`\$`,
  "&": String.raw`\&`,
  "#": String.raw`\#`,
  "_": String.raw`\_`,
  "%": String.raw`\%`,
  "~": String.raw`\textasciitilde{}`,
  "^": String.raw`\textasciicircum{}`,
};

export interface RenderResumeInput {
  selectedBulletIds: string[];
  selectedSkillNames: string[];
  outputName?: string;
}

export interface RenderResumeResult {
  texPath: string;
  selectedBulletCount: number;
  selectedSkillCount: number;
}

export function escapeLatex(value: string): string {
  return value.replace(
    /[\\{}$&#_%~^]/g,
    (character) => LATEX_REPLACEMENTS[character] ?? character,
  );
}

function safeUrl(value: string): string {
  return String.raw`\detokenize{${value}}`;
}

function formatMonth(value: string | "present"): string {
  if (value === "present") {
    return "Present";
  }

  const [year, monthValue] = value.split("-");
  const monthIndex = Number(monthValue) - 1;
  const monthName = MONTH_NAMES[monthIndex] ?? monthValue;

  return `${monthName} ${year}`;
}

function formatRange(startDate: string, endDate: string): string {
  return `${formatMonth(startDate)} -- ${formatMonth(endDate)}`;
}

function renderExperience(entry: PlannedExperience): string {
  const { experience, bullets } = entry;

  const role = String.raw`\role{${escapeLatex(
    experience.organization,
  )}}{${escapeLatex(experience.location)}}{${escapeLatex(
    experience.role,
  )}}{${formatRange(experience.startDate, experience.endDate)}}`;

  const bulletLines = bullets.map(
    (bullet) => String.raw`  \tightitem ${escapeLatex(bullet.text)}`,
  );

  return [
    role,
    String.raw`\begin{itemize}`,
    ...bulletLines,
    String.raw`\end{itemize}`,
  ].join("\n");
}

function renderGroupedExperience(
  entry: PlannedExperience,
): string {
  const { experience, bullets } = entry;

  const role = String.raw`\role{${escapeLatex(
    experience.organization,
  )}}{${escapeLatex(experience.location)}}{${escapeLatex(
    experience.role,
  )}}{${formatRange(experience.startDate, experience.endDate)}}`;

  const groupedBullets = new Map<
    string,
    {
      name?: string;
      order: number;
      bullets: typeof bullets;
    }
  >();

  for (const bullet of bullets) {
    const key = bullet.groupId ?? "default";
    const existing = groupedBullets.get(key);

    if (existing) {
      existing.bullets.push(bullet);
      continue;
    }

    groupedBullets.set(key, {
      ...(bullet.groupName
        ? { name: bullet.groupName }
        : {}),
      order: bullet.groupOrder ?? 0,
      bullets: [bullet],
    });
  }

  const sections = [...groupedBullets.values()]
    .sort((left, right) => left.order - right.order)
    .map((group) => {
      const heading = group.name
        ? String.raw`\project{${escapeLatex(group.name)}}`
        : "";

      const bulletLines = group.bullets.map(
        (bullet) =>
          String.raw`  \tightitem ${escapeLatex(
            bullet.text,
          )}`,
      );

      return [
        heading,
        String.raw`\begin{itemize}`,
        ...bulletLines,
        String.raw`\end{itemize}`,
      ]
        .filter((line) => line.length > 0)
        .join("\n");
    });

  return [role, ...sections].join("\n");
}

function renderSkills(
  categories: PlannedSkillCategory[],
): string {
  const rows = categories.map(({ category, skills }) => {
    const skillList = skills.map(escapeLatex).join(", ");

    return `${escapeLatex(category)} &\n${skillList}\\\\`;
  });

  return [
    String.raw`\section*{SKILLS}`,
    String.raw`\begin{tabularx}{\textwidth}{@{}>{\bfseries}p{3.3cm}X@{}}`,
    ...rows,
    String.raw`\end{tabularx}`,
  ].join("\n");
}

function renderAcademicProjects(profile: ResumeProfile): string {
  if (profile.academicProjects.length === 0) {
    return "";
  }

  const projects = profile.academicProjects.map((project) => {
    const heading = String.raw`\role{${escapeLatex(
      project.name,
    )}}{}{${escapeLatex(project.affiliation)}}{${formatRange(
      project.startDate,
      project.endDate,
    )}}`;

    const bullets = project.bullets.map(
      (bullet) => String.raw`  \tightitem ${escapeLatex(bullet)}`,
    );

    return [
      heading,
      String.raw`\begin{itemize}`,
      ...bullets,
      String.raw`\end{itemize}`,
    ].join("\n");
  });

  return [
    String.raw`\section*{ACADEMIC PROJECTS}`,
    projects.join("\n\\vspace{2pt}\n"),
  ].join("\n");
}

function renderEducation(profile: ResumeProfile): string {
  if (profile.education.length === 0) {
    return "";
  }

  const rows = profile.education.map((education) => {
    const location = education.location
      ? `, ${escapeLatex(education.location)}`
      : "";

    const details = education.details
      ? String.raw` \newline \quad ${escapeLatex(education.details)}`
      : "";

    return String.raw`\textbf{${escapeLatex(
      education.degree,
    )}}, ${escapeLatex(
      education.institution,
    )}${location}${details} & ${escapeLatex(
      education.graduationDate,
    )} \\[4pt]`;
  });

  return [
    String.raw`\section*{EDUCATION}`,
    String.raw`\begin{tabularx}{\textwidth}{@{}X r@{}}`,
    ...rows,
    String.raw`\end{tabularx}`,
  ].join("\n");
}

function renderCertifications(profile: ResumeProfile): string {
  if (profile.certificationsAndAwards.length === 0) {
    return "";
  }

  const separator = String.raw`\quad \textbullet \quad`;

  return [
    String.raw`\section*{CERTIFICATIONS \& AWARDS}`,
    profile.certificationsAndAwards
      .map(escapeLatex)
      .join(`\n${separator}\n`),
  ].join("\n");
}

export function buildLatexDocument(
  candidateName: string,
  profile: ResumeProfile,
  experiences: PlannedExperience[],
  skills: PlannedSkillCategory[],
): string {
  const experienceContent = experiences
    .map(renderGroupedExperience)
    .join("\n\\vspace{4pt}\n");

  const sections = [
    String.raw`\section*{EXPERIENCE}
${experienceContent}`,
    renderSkills(skills),
    renderAcademicProjects(profile),
    renderEducation(profile),
    renderCertifications(profile),
  ].filter((section) => section.length > 0);

  return String.raw`% Generated by Fellow Jobber
\documentclass[10pt,a4paper]{article}

\usepackage[a4paper,margin=1.35cm]{geometry}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage{microtype}
\usepackage{xcolor}
\usepackage{tabularx}
\usepackage{array}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\usepackage{fontawesome5}

\pagenumbering{gobble}
\definecolor{rulec}{HTML}{E5E7EB}

\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\renewcommand{\baselinestretch}{1.05}

\titleformat{\section}
  {\bfseries\large\color{black}}
  {}{0pt}{}
  [\vspace{2pt}{\color{rulec}\hrule}\vspace{6pt}\color{black}]

\titlespacing*{\section}{0pt}{10pt}{6pt}

\setlist[itemize]{
  leftmargin=*,
  itemsep=2pt,
  topsep=2pt,
  parsep=0pt,
  partopsep=0pt
}

\newcommand{\tightitem}{\item\vspace{-1pt}}

\newcommand{\role}[4]{%
  \textbf{#1} \hfill #2\\
  \textbf{#3} \hfill #4\\
}

\newcommand{\project}[1]{\textbf{#1}\\}

\begin{document}
\color{black}

{\Huge \textbf{${escapeLatex(candidateName)}}}\\[2pt]
\textbf{${escapeLatex(profile.headline)}}\\[6pt]

\begin{tabularx}{\textwidth}{@{}X r@{}}
${escapeLatex(profile.contact.location)} &
\faPhone\ \href{tel:${safeUrl(profile.contact.phone)}}{${escapeLatex(
    profile.contact.phone,
  )}} \\
\faEnvelope\ \href{mailto:${safeUrl(
    profile.contact.email,
  )}}{${escapeLatex(profile.contact.email)}} &
\faLinkedin\ \href{${safeUrl(
    profile.contact.linkedIn,
  )}}{${escapeLatex(profile.contact.linkedIn)}} \\
\faGithub\ \href{${safeUrl(
    profile.contact.github,
  )}}{${escapeLatex(profile.contact.github)}} &
Languages: ${profile.contact.languages.map(escapeLatex).join(", ")}
\end{tabularx}

${sections.join("\n\n")}

\end{document}
`;
}

function sanitizeOutputName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized.length === 0) {
    throw new Error("The output name is invalid.");
  }

  return sanitized;
}

export async function renderResumeLatex(
  input: RenderResumeInput,
): Promise<RenderResumeResult> {
  if (input.selectedBulletIds.length === 0) {
    throw new Error("At least one bullet must be selected.");
  }

  if (input.selectedBulletIds.length > 18) {
    throw new Error("A maximum of 18 bullets may be selected.");
  }

  if (input.selectedSkillNames.length === 0) {
    throw new Error("At least one skill must be selected.");
  }

  const [bulletBank, profile] = await Promise.all([
    loadBulletBank(),
    loadResumeProfile(),
  ]);

  const plan = buildResumePlan(
    bulletBank,
    profile,
    input.selectedBulletIds,
    input.selectedSkillNames,
  );

  const latex = buildLatexDocument(
    bulletBank.candidate.name,
    profile,
    plan.experiences,
    plan.skillCategories,
  );

  const outputName = sanitizeOutputName(
    input.outputName ?? "tailored-resume",
  );

  const outputPath = resolve(
    process.cwd(),
    "output",
    "pdf",
    `${outputName}.tex`,
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, latex, "utf8");

  return {
    texPath: relative(process.cwd(), outputPath),
    selectedBulletCount: input.selectedBulletIds.length,
    selectedSkillCount: input.selectedSkillNames.length,
  };
}


