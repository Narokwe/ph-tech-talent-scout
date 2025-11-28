import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { vertexAI } from '@genkit-ai/vertexai';
import { defineSecret } from 'firebase-functions/params';
import { onCallGenkit } from 'firebase-functions/v2/https';
import { genkit, z } from 'genkit';

enableFirebaseTelemetry();

const githubToken = defineSecret('GITHUB_TOKEN');

const ai = genkit({
  plugins: [vertexAI()],
  model: vertexAI.model('gemini-2.5-flash'),
});

const repoSchema = z.object({
  name: z.string(),
  language: z.string().nullable(),
  pushed_at: z.string(),
  stargazers_count: z.number(),
  forks: z.number(),
});

const githubEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  repo: z.object({
    id: z.number(),
    name: z.string(),
    url: z.string(),
  }),
  payload: z.object({
    commits: z
      .array(
        z.object({
          sha: z.string(),
          author: z.object({
            email: z.string(),
            name: z.string(),
          }),
          message: z.string(),
          distinct: z.boolean(),
          url: z.string(),
        }),
      )
      .optional(),
  }),
});

const githubEventsArraySchema = z.array(githubEventSchema);

const fetchGithubRepos = ai.defineTool(
  {
    name: 'fetchGithubRepos',
    description:
      'Fetches a list of public repositories for a given GitHub username sorted by pushed date (recently updated).',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.array(repoSchema),
  },
  async ({ username }) => {
    console.log(`Fetching repos for ${username}`);
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?sort=pushed&per_page=15`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Genkit-Repo-Roaster-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch repos from GitHub: ${response.statusText}`,
      );
    }

    const repos = await response.json();
    const reposParsed = z.array(repoSchema).parse(repos);

    return reposParsed.map((repo) => ({
      name: repo.name,
      language: repo.language,
      pushed_at: repo.pushed_at,
      stargazers_count: repo.stargazers_count,
      forks: repo.forks,
    }));
  },
);

const fetchLanguageStats = ai.defineTool(
  {
    name: 'fetchLanguageStats',
    description:
      'Analyzes programming languages used across all repositories to calculate usage statistics.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      languages: z.record(z.string(), z.number()),
      totalRepos: z.number(),
      topLanguages: z.array(
        z.object({
          name: z.string(),
          count: z.number(),
          percentage: z.number(),
        }),
      ),
    }),
  },
  async ({ username }) => {
    console.log(`Analyzing language stats for ${username}`);
    const response = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&type=all`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Genkit-Repo-Roaster-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch repos: ${response.statusText}`);
    }

    const repos = await response.json();
    const languages: Record<string, number> = {};
    let totalRepos = 0;

    for (const repo of repos) {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
        totalRepos++;
      }
    }

    const topLanguages = Object.entries(languages)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalRepos) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      languages,
      totalRepos,
      topLanguages,
    };
  },
);

const fetchStarredRepos = ai.defineTool(
  {
    name: 'fetchStarredRepos',
    description:
      'Fetches repositories that the user has starred to analyze their interests vs their own work.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      totalStarred: z.number(),
      topStarredLanguages: z.array(z.string()),
      recentStars: z.array(
        z.object({
          name: z.string(),
          language: z.string().nullable(),
          description: z.string().nullable(),
          stargazers_count: z.number(),
        }),
      ),
    }),
  },
  async ({ username }) => {
    console.log(`Fetching starred repos for ${username}`);
    const response = await fetch(
      `https://api.github.com/users/${username}/starred?per_page=20&sort=created`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Genkit-Repo-Roaster-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch starred repos: ${response.statusText}`);
    }

    const starred = await response.json();

    const languageCount: Record<string, number> = {};
    const recentStars = starred
      .slice(0, 10)
      .map(
        (repo: {
          name: string;
          language: string | null;
          description: string | null;
          stargazers_count: number;
        }) => {
          if (repo.language) {
            languageCount[repo.language] =
              (languageCount[repo.language] || 0) + 1;
          }
          return {
            name: repo.name,
            language: repo.language,
            description: repo.description,
            stargazers_count: repo.stargazers_count,
          };
        },
      );

    const topStarredLanguages = Object.entries(languageCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => lang);

    return {
      totalStarred: starred.length,
      topStarredLanguages,
      recentStars,
    };
  },
);

const fetchCommitMessages = ai.defineTool(
  {
    name: 'fetchCommitMessages',
    description:
      'Fetches commit messages from the last 100 events of a GitHub user.',
    inputSchema: z.object({
      username: z.string(),
    }),
    outputSchema: z.array(z.string()),
  },
  async ({ username }) => {
    const response = await fetch(
      `https://api.github.com/users/${username}/events?per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Genkit-Repo-Roaster-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to fetch commit messages from GitHub: ${response.statusText}`,
      );
    }

    const commits = await response.json();
    const commitsParsed = githubEventsArraySchema.parse(commits);
    console.log({ commitsParsed });
    return (
      commitsParsed
        .filter((event) => event.type === 'PushEvent')
        .filter(
          (event) => event.payload.commits && event.payload.commits.length > 0,
        )
        .flatMap(
          (commit) => commit.payload.commits?.map((c) => c.message) || [],
        )
    );
  },
);

const fetchGithubUserProfile = ai.defineTool(
  {
    name: 'fetchGithubUserProfile',
    description:
      'Fetches the public profile of a GitHub user including bio, followers, company, etc.',
    inputSchema: z.object({ username: z.string() }),
    outputSchema: z.object({
      login: z.string(),
      id: z.number(),
      avatar_url: z.string(),
      html_url: z.string(),
      name: z.string().nullable(),
      company: z.string().nullable(),
      blog: z.string().nullable(),
      location: z.string().nullable(),
      bio: z.string().nullable(),
      public_repos: z.number(),
      followers: z.number(),
      following: z.number(),
      created_at: z.string(),
      updated_at: z.string(),
    }),
  },
  async ({ username }) => {
    console.log(`Fetching profile for ${username}`);
    const response = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Genkit-Repo-Roaster-Agent',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch GitHub user profile: ${response.statusText}`,
      );
    }

    const profile = await response.json();

    return {
      login: profile.login,
      id: profile.id,
      avatar_url: profile.avatar_url,
      html_url: profile.html_url,
      name: profile.name,
      company: profile.company,
      blog: profile.blog,
      location: profile.location,
      bio: profile.bio,
      public_repos: profile.public_repos,
      followers: profile.followers,
      following: profile.following,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    };
  },
);

// Updated githubGrillerFlow with clean formatting
const githubGrillerFlow = ai.defineFlow(
  {
    name: 'githubGrillerFlow',
    inputSchema: z.object({
      username: z.string(),
      personality: z
        .enum([
          'public-health-recruiter',
          'epidemiologist', 
          'global-health-advocate',
          'health-systems-analyst',
          'technical-assessor'
        ])
        .default('public-health-recruiter'),
      intensity: z.number().min(1).max(5).default(3),
    }),
    outputSchema: z.string(),
  },
  async ({ username, personality, intensity }, streamCallack) => {
    const userCheckResponse = await fetch(
      `https://api.github.com/users/${username}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Genkit-Repo-Roaster-Agent',
        },
      },
    );

    const temperatureMap: Record<number, number> = {
      1: 0.3,
      2: 0.5,
      3: 0.7,
      4: 0.9,
      5: 1.2,
    };

    const temperature = temperatureMap[intensity] || 0.7;

    // Define personality prompts
    const personalityPrompts: Record<string, string> = {
      'public-health-recruiter':
        'You are a professional public health tech recruiter. Your goal is to identify developers whose skills could benefit global health initiatives. Be constructive, professional, and focus on matching technical skills with public health applications. Suggest specific health tech projects they could contribute to based on their expertise. Focus on skills like data analysis, system architecture, mobile development, or AI/ML that could be applied to healthcare challenges.',
      
      'epidemiologist':
        'You are an epidemiologist with tech expertise. Analyze the developer\'s data skills, statistical background, and experience with data-intensive projects. Focus on how their skills could be applied to disease surveillance, health data analysis, public health research, or epidemiological modeling. Look for experience with data visualization, statistical analysis, or machine learning.',
      
      'global-health-advocate':
        'You are a global health advocate focused on Sustainable Development Goals (SDGs), particularly SDG 3 (Good Health and Well-being). Assess how the developer\'s work could contribute to health equity, accessibility, and improving healthcare in underserved communities. Highlight opportunities for impact in areas like telemedicine, health information systems, or mobile health applications.',
      
      'health-systems-analyst':
        'You are a health systems analyst. Evaluate the developer\'s experience with scalable systems, infrastructure, reliability engineering, and security. Focus on how these skills could strengthen healthcare systems, improve health information systems, enhance telemedicine platforms, or ensure data privacy and security in health applications.',
      
      'technical-assessor':
        'You are a technical assessor for health tech organizations. Provide a balanced evaluation of technical strengths and growth areas, specifically in contexts relevant to healthcare applications like data security, compliance, system reliability, and interoperability with health data standards.',
    };

    const personalityPrompt =
      personalityPrompts[personality] || personalityPrompts['public-health-recruiter'];

    const intensityGuidelines: Record<number, string> = {
      1: 'Keep it very concise and high-level. Focus on the most obvious skills and potential health applications.',
      2: 'Provide a standard professional assessment. Cover main skill areas and suggest 2-3 relevant health tech opportunities.',
      3: 'Give a detailed analysis. Include specific skill mappings, health domain applications, and actionable recommendations.',
      4: "Provide comprehensive insights. Include detailed skill analysis, multiple health application areas, and strategic recommendations.",
      5: 'Deliver an in-depth evaluation. Cover all aspects thoroughly with strategic insights, gap analysis, and long-term potential.',
    };

    const intensityGuideline =
      intensityGuidelines[intensity] || intensityGuidelines[3];

    if (userCheckResponse.status === 404) {
      const { response, stream } = ai.generateStream({
        prompt: `
          ${personalityPrompt}
          
          ${intensityGuideline}
          
          The user tried to analyze a GitHub profile but entered a username "${username}" that doesn't exist on GitHub (404 error).
          
          Provide a professional response about this issue and suggest they check the username spelling. Mention the importance of accurate data in public health technology contexts.
          
          Keep it professional and helpful (2-3 sentences).
        `,
        config: {
          temperature: temperature,
        },
        model: vertexAI.model('gemini-2.0-flash-exp'),
      });

      for await (const chunk of stream) {
        streamCallack(chunk);
      }

      const { text } = await response;
      return text;
    }

    const { response, stream } = ai.generateStream({
      prompt: `
          ${personalityPrompt}
          
          Your task is to provide a professional assessment of a developer's potential contributions to public health technology.

          ${intensityGuideline}

          IMPORTANT FORMATTING RULES:
          - Use ONLY plain text, NO markdown formatting
          - NO asterisks (*), hashtags (#), or other markdown symbols
          - NO bold, italics, or underline formatting
          - Use clear section headings with emojis instead of markdown
          - Use line breaks and spacing for readability
          - Current year is 2025 - use this for any time references

          Be constructive, professional, and data-driven. Focus on matching technical skills with public health applications and suggesting concrete opportunities.

          Here's the Github Username: "${username}". 
          
          You have access to several tools to fetch their GitHub data (profile, repositories, commit messages, language statistics, and starred repositories). Use these tools to gather information about their skills, experience, and interests.

          Provide a professional assessment covering:

          🛠️ TECHNICAL SKILLS ANALYSIS
          - Technical strengths relevant to health tech
          - Data and analysis capabilities  
          - System architecture experience
          - Programming language proficiency

          🏥 HEALTH TECH APPLICATIONS
          - Potential contributions to disease surveillance systems
          - Health data management and analysis
          - Telemedicine and mobile health applications
          - Public health research tools
          - Health information systems

          📈 RECOMMENDATIONS & OPPORTUNITIES
          - Specific health tech projects they could contribute to
          - Skills development suggestions for health tech
          - Potential impact areas in global health
          - Open source health projects to explore

          Return the assessment as a clean, well-structured professional report using only plain text. Focus on actionable insights and practical recommendations.
      `,
      tools: [
        fetchGithubRepos,
        fetchGithubUserProfile,
        fetchLanguageStats,
        fetchStarredRepos,
      ],
      config: {
        temperature: temperature,
      },
    });

    for await (const chunk of stream) {
      streamCallack(chunk);
    }

    const { text } = await response;
    console.log({ text });

    return text;
  },
);

export const githubGrillerFunction = onCallGenkit(
  {
    secrets: [githubToken],
  },
  githubGrillerFlow,
);