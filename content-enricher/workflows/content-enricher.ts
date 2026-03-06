// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable } from "workflow";

export type EnrichmentSource = "crm" | "social" | "clearbit" | "github";

export type EnrichmentEvent =
  | { type: "base_lookup" }
  | { type: "base_done"; name: string; domain: string }
  | { type: "source_start"; source: EnrichmentSource }
  | { type: "source_done"; source: EnrichmentSource; data: unknown }
  | { type: "source_failed"; source: EnrichmentSource; error: string }
  | { type: "merging" }
  | { type: "done"; profile: EnrichedLeadProfile };

export type BaseLead = {
  email: string;
  name: string;
  domain: string;
};

export type CrmEnrichment = {
  company: string;
  title: string;
  segment: "enterprise" | "mid-market";
};

export type SocialEnrichment = {
  followers: number;
  location: string;
  profileUrl: string;
};

export type ClearbitEnrichment = {
  company: string;
  employees: number;
  score: number;
};

export type GitHubEnrichment = {
  username: string;
  publicRepos: number;
  stars: number;
};

export type PartialEnrichmentPayload = {
  crm: CrmEnrichment | null;
  social: SocialEnrichment | null;
  clearbit: ClearbitEnrichment | null;
  github: GitHubEnrichment | null;
};

export type EnrichedLeadProfile = {
  email: string;
  name: string;
  domain: string;
  company: string | null;
  title: string | null;
  followers: number | null;
  location: string | null;
  githubUsername: string | null;
  githubStars: number | null;
  clearbitScore: number | null;
  segment: string | null;
};

export type LeadEnrichmentResult = {
  email: string;
  baseLead: BaseLead;
  sources: Record<EnrichmentSource, "fulfilled" | "rejected">;
  profile: EnrichedLeadProfile;
};

// Demo: simulate real-world network latency so the UI can show progress.
const SOURCE_DELAY_MS: Record<EnrichmentSource, number> = {
  crm: 700,
  social: 640,
  clearbit: 810,
  github: 760,
};

const BASE_DELAY_MS = 500;
const MERGE_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichLeadProfile(email: string): Promise<LeadEnrichmentResult> {
  "use workflow";

  const baseLead = await lookupBaseContact(email);

  const [crm, social, clearbit, github] = await Promise.allSettled([
    fetchCrmEnrichment(baseLead),
    fetchSocialEnrichment(baseLead),
    fetchClearbitEnrichment(baseLead),
    fetchGitHubEnrichment(baseLead),
  ]);

  const profile = await mergeEnrichmentProfile(baseLead, {
    crm: crm.status === "fulfilled" ? crm.value : null,
    social: social.status === "fulfilled" ? social.value : null,
    clearbit: clearbit.status === "fulfilled" ? clearbit.value : null,
    github: github.status === "fulfilled" ? github.value : null,
  });

  return {
    email: baseLead.email,
    baseLead,
    sources: {
      crm: crm.status,
      social: social.status,
      clearbit: clearbit.status,
      github: github.status,
    },
    profile,
  };
}

async function lookupBaseContact(email: string): Promise<BaseLead> {
  "use step";

  const writer = getWritable<EnrichmentEvent>().getWriter();
  try {
    await writer.write({ type: "base_lookup" });
    await delay(BASE_DELAY_MS);

    const normalized = email.trim().toLowerCase();
    const [localPart = "lead", domain = "example.com"] = normalized.split("@");
    const lead: BaseLead = {
      email: normalized,
      name: humanizeLocalPart(localPart),
      domain,
    };

    await writer.write({ type: "base_done", name: lead.name, domain: lead.domain });
    return lead;
  } finally {
    writer.releaseLock();
  }
}

async function fetchCrmEnrichment(baseLead: BaseLead): Promise<CrmEnrichment> {
  "use step";

  const writer = getWritable<EnrichmentEvent>().getWriter();
  try {
    await writer.write({ type: "source_start", source: "crm" });
    await delay(SOURCE_DELAY_MS.crm);

    if (shouldForceFailure(baseLead.email, "crm")) {
      const error = "CRM enrichment temporarily unavailable";
      await writer.write({ type: "source_failed", source: "crm", error });
      throw new Error(error);
    }

    const data: CrmEnrichment = {
      company: titleCase(baseLead.domain.split(".")[0] ?? "Example"),
      title: "Senior Product Manager",
      segment: "mid-market",
    };

    await writer.write({ type: "source_done", source: "crm", data });
    return data;
  } finally {
    writer.releaseLock();
  }
}

async function fetchSocialEnrichment(baseLead: BaseLead): Promise<SocialEnrichment> {
  "use step";

  const writer = getWritable<EnrichmentEvent>().getWriter();
  try {
    await writer.write({ type: "source_start", source: "social" });
    await delay(SOURCE_DELAY_MS.social);

    if (shouldForceFailure(baseLead.email, "social")) {
      const error = "Social enrichment temporarily unavailable";
      await writer.write({ type: "source_failed", source: "social", error });
      throw new Error(error);
    }

    const data: SocialEnrichment = {
      followers: 1830,
      location: "San Francisco, CA",
      profileUrl: `https://linkedin.com/in/${baseLead.name.toLowerCase().replace(/\s+/g, "-")}`,
    };

    await writer.write({ type: "source_done", source: "social", data });
    return data;
  } finally {
    writer.releaseLock();
  }
}

async function fetchClearbitEnrichment(baseLead: BaseLead): Promise<ClearbitEnrichment> {
  "use step";

  const writer = getWritable<EnrichmentEvent>().getWriter();
  try {
    await writer.write({ type: "source_start", source: "clearbit" });
    await delay(SOURCE_DELAY_MS.clearbit);

    if (shouldForceFailure(baseLead.email, "clearbit")) {
      const error = "Clearbit enrichment temporarily unavailable";
      await writer.write({ type: "source_failed", source: "clearbit", error });
      throw new Error(error);
    }

    const data: ClearbitEnrichment = {
      company: titleCase(baseLead.domain.split(".")[0] ?? "Example"),
      employees: 240,
      score: 78,
    };

    await writer.write({ type: "source_done", source: "clearbit", data });
    return data;
  } finally {
    writer.releaseLock();
  }
}

async function fetchGitHubEnrichment(baseLead: BaseLead): Promise<GitHubEnrichment> {
  "use step";

  const writer = getWritable<EnrichmentEvent>().getWriter();
  try {
    await writer.write({ type: "source_start", source: "github" });
    await delay(SOURCE_DELAY_MS.github);

    if (shouldForceFailure(baseLead.email, "github")) {
      const error = "GitHub enrichment temporarily unavailable";
      await writer.write({ type: "source_failed", source: "github", error });
      throw new Error(error);
    }

    const data: GitHubEnrichment = {
      username: baseLead.name.toLowerCase().replace(/\s+/g, ""),
      publicRepos: 23,
      stars: 412,
    };

    await writer.write({ type: "source_done", source: "github", data });
    return data;
  } finally {
    writer.releaseLock();
  }
}

async function mergeEnrichmentProfile(
  baseLead: BaseLead,
  sources: PartialEnrichmentPayload
): Promise<EnrichedLeadProfile> {
  "use step";

  const writer = getWritable<EnrichmentEvent>().getWriter();
  try {
    await writer.write({ type: "merging" });
    await delay(MERGE_DELAY_MS);

    const profile: EnrichedLeadProfile = {
      email: baseLead.email,
      name: baseLead.name,
      domain: baseLead.domain,
      company: sources.crm?.company ?? sources.clearbit?.company ?? null,
      title: sources.crm?.title ?? null,
      followers: sources.social?.followers ?? null,
      location: sources.social?.location ?? null,
      githubUsername: sources.github?.username ?? null,
      githubStars: sources.github?.stars ?? null,
      clearbitScore: sources.clearbit?.score ?? null,
      segment: sources.crm?.segment ?? null,
    };

    await writer.write({ type: "done", profile });
    return profile;
  } finally {
    writer.releaseLock();
  }
}

function shouldForceFailure(email: string, source: EnrichmentSource): boolean {
  const localPart = email.split("@")[0] ?? "";
  const plusSection = localPart.split("+")[1] ?? "";
  const flags = plusSection.split(".").filter(Boolean);
  return flags.includes(`fail-${source}`) || flags.includes(`fail${source}`);
}

function humanizeLocalPart(localPart: string): string {
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => titleCase(part))
    .join(" ");
}

function titleCase(value: string): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}
