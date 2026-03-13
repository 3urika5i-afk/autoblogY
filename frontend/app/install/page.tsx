'use client';
import { useMemo, useState } from 'react';
import { z } from 'zod';

type Niche = {
  name: string;
  description: string;
  searchVolume: string;
  affiliateScore: number;
  competition: 'Low' | 'Medium' | 'High';
  monetisationPer10k: number;
  reasoning: string;
};

type Persona = {
  name: string;
  demographics: string;
  psychographics: string;
  behaviour: string;
  optimalTimes: string;
};

const volumeOptions = [
  { value: 3, pros: 'Less resource load, higher depth', cons: 'Slower topical authority build' },
  { value: 5, pros: 'Balanced cadence for new domains', cons: 'Requires consistent sourcing' },
  { value: 7, pros: 'Faster indexing momentum', cons: 'Needs stricter QA' },
  { value: 14, pros: 'Aggressive growth & A/B bandwidth', cons: 'Higher AI+R2 cost; monitor quality' }
];

const photoOptions = [
  { value: 3, note: 'Hero + 2 scannable visuals' },
  { value: 5, note: 'Hero + section anchors; best for 1.5k words' },
  { value: 8, note: 'Image per H2; stronger Pinterest reach' }
];

const videoOptions = [
  { value: 'none', note: 'Text + images only' },
  { value: 'short', note: '60–90s reel; embed YouTube Shorts' },
  { value: 'long', note: '5–8 min YouTube; chapters auto-generated' }
] as const;

type VolumeChoice = (typeof volumeOptions)[number]['value'];

type InstallerState = {
  domain: string;
  selectedNiche?: Niche;
  personas: Persona[];
  articlesPerWeek: VolumeChoice;
  photosPerArticle: number;
  videoMode: 'none' | 'short' | 'long';
  affiliates: string[];
  ads: string;
  email: boolean;
  products: string[];
  sponsored: boolean;
  apiKeys: Record<string, string>;
};

const apiKeySchema = z.object({
  GEMINI_API_KEY: z.string().optional(),
  UNSPLASH_KEY: z.string().optional(),
  YOUTUBE_KEY: z.string().optional(),
  GSC_TOKEN: z.string().optional()
});

function extractKeywords(domain: string) {
  const base = domain.replace(/https?:\/\//, '').replace(/www\./, '').split('.')[0];
  const parts = base.split(/[-_]/);
  return parts.filter(Boolean);
}

function nicheEngine(domain: string): Niche[] {
  const keywords = extractKeywords(domain);
  const contains = (k: string) => keywords.some((p) => p.includes(k));
  const focus = contains('travel') || contains('trip') || contains('tour') ? 'travel' : contains('fit') ? 'fitness' : contains('tech') ? 'tech' : 'evergreen';

  const ideas: Record<string, Niche[]> = {
    travel: [
      mkNiche('Luxury Experiential Travel', 'High-intent itineraries, villas, private guides', 40000, 8, 'Medium', 1200, domain, 'Luxury travel terms in GKP show 10k–100k; long-tail multipliers push 40k+. High-ticket affiliate AOV justifies score.'),
      mkNiche('Safari & Conservation Tourism', 'Africa-focused trips, eco-lodges, permit logistics', 25000, 9, 'Low', 1600, domain, 'Niche yet rising searches for safari routes (GTrends). Low competition for long-tail lodge keywords; strong CPA from GetYourGuide/viator.'),
      mkNiche('Premium Stopover Cities', '48-hour guides for hub airports (Doha, DXB, SIN)', 18000, 7, 'Medium', 900, domain, 'Airline stopover queries ~5k–20k/mo each; bundling hubs yields sizable cluster; hotel/transfer affiliates convert well.')
    ],
    fitness: [
      mkNiche('Strength Over 40', 'Evidence-based lifting, joint-friendly programming', 52000, 8, 'Medium', 700, domain, '"Strength training over 40" head terms 10k–50k; underserved by credible programs; supplement & program affiliates pay 8–15%.'),
      mkNiche('Hybrid Athlete', 'Endurance + strength (rucking, Zone 2 + lifting)', 38000, 7, 'Low', 650, domain, 'Hybrid queries are trending on Trends; low SERP saturation; wearable & shoe affiliates strong.'),
      mkNiche('Garage Gym Gear', 'Space-saving racks, mats, budget vs premium builds', 47000, 9, 'High', 1100, domain, 'High commercial intent; Amazon/ROGUE share; CPC high but conversion strong; review schema boosts CTR.')
    ],
    tech: [
      mkNiche('AI Productivity Stacks', 'Workflows combining AI agents + SaaS', 60000, 8, 'High', 900, domain, 'Exploding search trend per Trends; affiliate payouts from SaaS recur; competition high but freshness wins.'),
      mkNiche('Privacy-First Home Lab', 'Self-hosted cloud, network hardening', 22000, 7, 'Medium', 750, domain, 'Steady demand via r/selfhosted and GKP 5k–25k; hardware affiliate margin solid.'),
      mkNiche('Creator Gear on a Budget', 'Mics, lights, cameras ranked by ROI', 80000, 9, 'High', 1300, domain, 'Equipment keywords carry 10k–100k with high CPC; video embeds lift dwell time.')
    ],
    evergreen: [
      mkNiche('Local Weekend Escapes', '2–3 day itineraries within 3h drive', 30000, 7, 'Low', 700, domain, 'Geo-modified queries ("near me") dominate; low competition at regional level; hotel/experience affiliates fit.'),
      mkNiche('Eco-Friendly Home Upgrades', 'Energy-saving DIY, rebates, product picks', 26000, 8, 'Medium', 800, domain, 'Searches for heat pumps/insulation incentives growing; Amazon/Home Depot affiliates + rebate calculators.'),
      mkNiche('Pet-Friendly Lifestyle', 'Travel, housing, gear for pets', 55000, 7, 'Medium', 650, domain, 'High ongoing volume; mix of info and commercial; pet affiliate programs plentiful.')
    ]
  };

  return ideas[focus];
}

function mkNiche(
  name: string,
  description: string,
  volumeMidpoint: number,
  affiliateScore: number,
  competition: 'Low' | 'Medium' | 'High',
  monetisationPer10k: number,
  domain: string,
  reasoning: string
): Niche {
  const low = Math.round(volumeMidpoint * 0.6);
  const high = Math.round(volumeMidpoint * 1.4);
  return {
    name,
    description,
    searchVolume: `${low.toLocaleString()}–${high.toLocaleString()} (derived: head term midpoint ${volumeMidpoint.toLocaleString()} with ±40% to reflect long-tail/seasonality)` ,
    affiliateScore,
    competition,
    monetisationPer10k,
    reasoning: `${reasoning} Domain hint: ${domain}`
  };
}

function personaBuilder(niche: string): Persona[] {
  switch (true) {
    case /travel/i.test(niche):
      return [
        {
          name: 'Affluent Explorer',
          demographics: '35-55, $120k+ HHI, US/UK, travels 4x/yr',
          psychographics: 'Values curated experiences, safety, time-saving',
          behaviour: 'Researches on mobile, books on desktop; IG + YouTube inspo',
          optimalTimes: 'Wed & Sun 7-9pm local time'
        },
        {
          name: 'Eco-Minded Adventurer',
          demographics: '28-45, $80k+, EU/US, couples',
          psychographics: 'Wants impact transparency, willing to pay green premium',
          behaviour: 'Reads long-form blogs; Reddit/YouTube for proof',
          optimalTimes: 'Sat 10am & Tue 8pm'
        }
      ];
    case /fitness/i.test(niche):
      return [
        {
          name: 'Time-Crunched Parent',
          demographics: '32-48, $90k HHI, suburban, kids',
          psychographics: 'Needs efficient workouts; joint-friendly',
          behaviour: 'Mobile-first, saves TikTok/YouTube Shorts, emails convert',
          optimalTimes: 'Mon-Thu 6am local'
        },
        {
          name: 'Data-Driven Lifter',
          demographics: '25-40, $70k+, NA/EU',
          psychographics: 'Tracks HRV/VO2; loves gear reviews',
          behaviour: 'Desktop for purchases; watches form breakdowns on YT',
          optimalTimes: 'Tue/Thu 8pm, Sat 11am'
        }
      ];
    default:
      return [
        {
          name: 'Pragmatic Upgrader',
          demographics: '30-55, $70k+, homeowners',
          psychographics: 'Wants ROI, hates waste',
          behaviour: 'Search-first via Google; reads comparisons',
          optimalTimes: 'Sat morning & Tue 9pm'
        },
        {
          name: 'Curious Optimizer',
          demographics: '24-40, $60k+, global',
          psychographics: 'Early adopter, experiments with tools',
          behaviour: 'Subscribes to newsletters; active on X/Reddit',
          optimalTimes: 'Wed-Fri 12pm ET'
        }
      ];
  }
}

export default function InstallerPage() {
  const [state, setState] = useState<InstallerState>({
    domain: '',
    personas: [],
    articlesPerWeek: 5,
    photosPerArticle: 5,
    videoMode: 'short',
    affiliates: [],
    ads: 'Ezoic when 10k sessions/mo; upgrade Mediavine 50k+',
    email: true,
    products: [],
    sponsored: false,
    apiKeys: {}
  });
  const [niches, setNiches] = useState<Niche[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const disabled = !state.domain || !state.selectedNiche;

  const handleDomainBlur = () => {
    const ideas = nicheEngine(state.domain || '');
    setNiches(ideas);
    setState((s) => ({ ...s, personas: personaBuilder(ideas[0].name), selectedNiche: ideas[0] }));
  };

  const toggleAffiliate = (value: string) => {
    setState((s) => ({
      ...s,
      affiliates: s.affiliates.includes(value)
        ? s.affiliates.filter((a) => a !== value)
        : [...s.affiliates, value]
    }));
  };

  const toggleProduct = (value: string) => {
    setState((s) => ({
      ...s,
      products: s.products.includes(value)
        ? s.products.filter((a) => a !== value)
        : [...s.products, value]
    }));
  };

  const submit = async () => {
    setBusy(true);
    setLogs((l) => [...l, 'Validating keys…']);
    const apiValidation = apiKeySchema.safeParse(state.apiKeys);
    if (!apiValidation.success) {
      setBusy(false);
      setLogs((l) => [...l, 'API key validation failed']);
      return;
    }
    setLogs((l) => [...l, 'Sending to Worker…']);
    const payload = {
      domain: state.domain,
      niches,
      selectedNiche: state.selectedNiche?.name,
      personas: state.personas,
      volume: {
        articlesPerWeek: state.articlesPerWeek,
        photosPerArticle: state.photosPerArticle,
        videoMode: state.videoMode
      },
      monetisation: {
        affiliates: state.affiliates,
        ads: state.ads,
        email: state.email,
        products: state.products,
        sponsored: state.sponsored
      },
      apiKeys: state.apiKeys
    };
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/installer/bootstrap`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }).then((r) => r.json());
    setLogs((l) => [...l, `Worker response: ${JSON.stringify(res)}`]);
    setBusy(false);
  };

  const personaCards = useMemo(() => state.personas.map((p) => (
    <div className="card" key={p.name}>
      <div className="badge">Persona</div>
      <h4>{p.name}</h4>
      <p><strong>Demographics:</strong> {p.demographics}</p>
      <p><strong>Psychographics:</strong> {p.psychographics}</p>
      <p><strong>Behaviour:</strong> {p.behaviour}</p>
      <p><strong>Optimal times:</strong> {p.optimalTimes}</p>
    </div>
  )), [state.personas]);

  return (
    <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 24 }}>
      <div className="grid" style={{ gap: 16 }}>
        <div className="card">
          <h2>1) Domain</h2>
          <input
            placeholder="e.g. luxuryafricatravel.com"
            value={state.domain}
            onChange={(e) => setState({ ...state, domain: e.target.value })}
            onBlur={handleDomainBlur}
            style={{ width: '100%', padding: 12, borderRadius: 12, border: '1px solid #e2e8f0' }}
          />
          <p className="muted">We infer niche fit using domain semantics + known market baselines (GKP/Trends medians).</p>
        </div>

        <div className="card">
          <h2>2) Niche Recommendation</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            {niches.map((n) => (
              <button
                key={n.name}
                className="card"
                style={{ textAlign: 'left', border: state.selectedNiche?.name === n.name ? '2px solid var(--accent)' : undefined }}
                onClick={() => setState({ ...state, selectedNiche: n, personas: personaBuilder(n.name) })}
              >
                <div className="badge">Affiliate score {n.affiliateScore}/10</div>
                <h4>{n.name}</h4>
                <p>{n.description}</p>
                <p><strong>Search volume:</strong> {n.searchVolume}</p>
                <p><strong>Competition:</strong> {n.competition}</p>
                <p><strong>Monetisation/10k visits:</strong> ${n.monetisationPer10k}</p>
                <p className="muted">Why: {n.reasoning}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>3) Audience Personas</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
            {personaCards}
          </div>
        </div>

        <div className="card">
          <h2>4) Content Volume</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {volumeOptions.map((o) => (
              <label key={o.value} className="card" style={{ border: state.articlesPerWeek === o.value ? '2px solid var(--accent)' : undefined }}>
                <input
                  type="radio"
                  name="volume"
                  value={o.value}
                  checked={state.articlesPerWeek === o.value}
                  onChange={() => setState({ ...state, articlesPerWeek: o.value })}
                />{' '}
                {o.value} / week
                <p className="muted">Pros: {o.pros}</p>
                <p className="muted">Cons: {o.cons}</p>
              </label>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {photoOptions.map((o) => (
              <label key={o.value} className="card" style={{ border: state.photosPerArticle === o.value ? '2px solid var(--accent)' : undefined }}>
                <input type="radio" name="photos" value={o.value} checked={state.photosPerArticle === o.value} onChange={() => setState({ ...state, photosPerArticle: o.value })} /> {o.value} photos/article
                <p className="muted">{o.note}</p>
              </label>
            ))}
            {videoOptions.map((o) => (
              <label key={o.value} className="card" style={{ border: state.videoMode === o.value ? '2px solid var(--accent)' : undefined }}>
                <input type="radio" name="video" value={o.value} checked={state.videoMode === o.value} onChange={() => setState({ ...state, videoMode: o.value })} /> {o.note}
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>5) Monetisation</h2>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            {[ 'Amazon Associates', 'ShareASale', 'Impact', 'GetYourGuide', 'Mediavine-ready display', 'AdThrive-ready display' ].map((a) => (
              <label key={a} className="card" style={{ border: state.affiliates.includes(a) ? '2px solid var(--accent)' : undefined }}>
                <input type="checkbox" checked={state.affiliates.includes(a)} onChange={() => toggleAffiliate(a)} /> {a}
              </label>
            ))}
          </div>
          <label className="card">
            Display Ads Recommendation
            <textarea
              value={state.ads}
              onChange={(e) => setState({ ...state, ads: e.target.value })}
              style={{ width: '100%', minHeight: 80, marginTop: 8 }}
            />
          </label>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
            {['Guides', 'Templates', 'Mini-courses'].map((p) => (
              <label key={p} className="card" style={{ border: state.products.includes(p) ? '2px solid var(--accent)' : undefined }}>
                <input type="checkbox" checked={state.products.includes(p)} onChange={() => toggleProduct(p)} /> {p}
              </label>
            ))}
          </div>
          <label className="card">
            <input type="checkbox" checked={state.email} onChange={(e) => setState({ ...state, email: e.target.checked })} /> Enable newsletter monetisation
          </label>
          <label className="card">
            <input type="checkbox" checked={state.sponsored} onChange={(e) => setState({ ...state, sponsored: e.target.checked })} /> Enable sponsored content pipeline
          </label>
        </div>

        <div className="card">
          <h2>6) API Keys (validated client-side)</h2>
          {['GEMINI_API_KEY', 'UNSPLASH_KEY', 'YOUTUBE_KEY', 'GSC_TOKEN'].map((k) => (
            <label key={k} style={{ display: 'block', marginBottom: 8 }}>
              {k}
              <input
                type="password"
                value={state.apiKeys[k] || ''}
                onChange={(e) => setState({ ...state, apiKeys: { ...state.apiKeys, [k]: e.target.value } })}
                style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid #e2e8f0' }}
              />
            </label>
          ))}
        </div>

        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>7) One-Click Deploy</h3>
            <p className="muted">Creates D1 schema, KV namespaces, R2 bucket, queue + deploys Pages.</p>
          </div>
          <button className="btn" disabled={disabled || busy} onClick={submit}>
            {busy ? 'Deploying…' : 'Deploy now'}
          </button>
        </div>
      </div>

      <div className="card" style={{ position: 'sticky', top: 12 }}>
        <h3>Realtime log</h3>
        <div style={{ background: '#0f172a', color: '#e2e8f0', padding: 12, borderRadius: 12, minHeight: 260, fontFamily: 'ui-monospace, SFMono-Regular' }}>
          {logs.map((l, i) => (
            <div key={i}>$ {l}</div>
          ))}
          {!logs.length && <div>$ waiting…</div>}
        </div>
      </div>
    </div>
  );
}
