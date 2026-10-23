import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Member = { id: string; display_name: string | null; developer_name?: string | null; avatar_url: string | null; bio?: string | null };
type Role = "founder" | "investor" | "both";
type Currency = "MWK" | "USD" | "ZAR" | "GBP" | "EUR";
type Opportunity = { id: string; founder_id: string; title: string; description: string; industry: string; stage: string; funding_goal: number | null; currency: string; use_of_funds: string | null; status: "open" | "paused" | "closed"; created_at: string };
type InvestmentProfile = { user_id: string; role: Role; organization_name: string | null; headline: string | null; bio: string | null; location: string | null; visibility: "public" | "connections" };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const socialDb = supabase as any;
const inputClass = "min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm";
const labelClass = "grid gap-1.5 text-xs font-medium";

export function InvestGrowPanel({ userId, members, acceptedIds, onConnect, onMessage }: {
  userId: string;
  members: Member[];
  acceptedIds: Set<string>;
  onConnect: (userId: string) => void;
  onMessage: (userId: string) => void;
}) {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>("both");
  const [organization, setOrganization] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState<"idea" | "prototype" | "early_revenue" | "growth" | "established">("idea");
  const [goal, setGoal] = useState("");
  const [currency, setCurrency] = useState<Currency>("MWK");
  const [useOfFunds, setUseOfFunds] = useState("");

  const myProfile = useQuery({
    queryKey: ["social", "investment-profile", userId],
    queryFn: async () => {
      const { data, error } = await socialDb.from("social_investment_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data as InvestmentProfile | null;
    },
  });
  // Populate the form from the saved record once, without overwriting edits during background refetches.
  const [profileHydrated, setProfileHydrated] = useState(false);
  useEffect(() => {
    if (!myProfile.data || profileHydrated) return;
    setRole(myProfile.data.role);
    setOrganization(myProfile.data.organization_name ?? "");
    setHeadline(myProfile.data.headline ?? "");
    setBio(myProfile.data.bio ?? "");
    setLocation(myProfile.data.location ?? "");
    setProfileHydrated(true);
  }, [myProfile.data, profileHydrated]);

  const directory = useQuery({
    queryKey: ["social", "investment-profiles"],
    queryFn: async () => {
      const { data, error } = await socialDb.from("social_investment_profiles").select("*").order("updated_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as InvestmentProfile[];
    },
  });
  const opportunities = useQuery({
    queryKey: ["social", "investment-opportunities"],
    queryFn: async () => {
      const { data, error } = await socialDb.from("social_investment_opportunities").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Opportunity[];
    },
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["social", "investment-profile", userId] }),
      qc.invalidateQueries({ queryKey: ["social", "investment-profiles"] }),
      qc.invalidateQueries({ queryKey: ["social", "investment-opportunities"] }),
    ]);
  };
  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await socialDb.from("social_investment_profiles").upsert({
        user_id: userId, role, organization_name: organization.trim() || null,
        headline: headline.trim() || null, bio: bio.trim() || null,
        location: location.trim() || null, visibility: "public", currency: "MWK",
      }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: async () => { setProfileHydrated(false); await refresh(); toast.success("Find Investors profile saved"); },
    onError: (error: Error) => toast.error(error.message || "Could not save profile"),
  });
  const createOpportunity = useMutation({
    mutationFn: async () => {
      if (title.trim().length < 3) throw new Error("Title must be at least 3 characters");
      if (description.trim().length < 20) throw new Error("Description must be at least 20 characters");
      if (industry.trim().length < 2) throw new Error("Enter an industry");
      const fundingGoal = goal.trim() ? Number(goal) : null;
      if (fundingGoal !== null && (!Number.isFinite(fundingGoal) || fundingGoal <= 0)) throw new Error("Funding target must be positive");
      const { error } = await socialDb.from("social_investment_opportunities").insert({
        founder_id: userId, title: title.trim(), description: description.trim(), industry: industry.trim(),
        stage, funding_goal: fundingGoal, currency, use_of_funds: useOfFunds.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => { setTitle(""); setDescription(""); setIndustry(""); setGoal(""); setUseOfFunds(""); await refresh(); toast.success("Opportunity published"); },
    onError: (error: Error) => toast.error(error.message || "Could not publish opportunity"),
  });
  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "open" | "paused" | "closed" }) => {
      const { error } = await socialDb.from("social_investment_opportunities").update({ status }).eq("id", id).eq("founder_id", userId);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message || "Could not update opportunity"),
  });
  const submitProfile = (e: FormEvent) => { e.preventDefault(); saveProfile.mutate(); };
  const submitOpportunity = (e: FormEvent) => { e.preventDefault(); createOpportunity.mutate(); };
  const memberById = new Map(members.map((member) => [member.id, member]));
  const memberName = (member?: Member) => member?.developer_name || member?.display_name || "MAS member";

  return <div className="w-full space-y-6 bg-background px-4 py-5 sm:px-6 lg:px-8">
    <header><div className="flex items-center gap-3"><BriefcaseBusiness className="h-6 w-6 text-primary" /><div><h2 className="text-xl font-semibold">Find Investors</h2><p className="mt-1 text-sm text-muted-foreground">Founders and investors can discover each other, publish opportunities and continue conversations through MAS Social.</p></div></div><p className="mt-3 text-xs leading-5 text-muted-foreground">Listings are introductions, not verified investments or financial advice. MAS does not process investments here.</p></header>
    <section className="border border-border p-4 sm:p-5"><h3 className="font-semibold">Your founder / investor profile</h3><form onSubmit={submitProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>I am here as<select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}><option value="founder">Founder / entrepreneur</option><option value="investor">Investor</option><option value="both">Both</option></select></label>
      <label className={labelClass}>Organization / startup<input value={organization} onChange={(e) => setOrganization(e.target.value)} maxLength={120} placeholder="Company or startup name" className={inputClass} /></label>
      <label className={cn(labelClass, "sm:col-span-2")}>Headline<input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={160} placeholder="What are you building or investing in?" className={inputClass} /></label>
      <label className={cn(labelClass, "sm:col-span-2")}>About you / investment interests<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1500} rows={3} placeholder="Tell members what you do and what you want to connect about." className={inputClass} /></label>
      <label className={labelClass}>Location<input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} placeholder="e.g. Lilongwe, Malawi" className={inputClass} /></label>
      <div className="flex items-end"><button type="submit" disabled={saveProfile.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{saveProfile.isPending ? "Saving…" : "Save profile"}</button></div>
    </form>{myProfile.isError && <p role="alert" className="mt-3 text-sm text-destructive">Find Investors needs the latest MAS Social database migration before this profile can load.</p>}</section>
    <section className="border border-border p-4 sm:p-5"><h3 className="font-semibold">Publish a startup opportunity</h3><p className="mt-1 text-sm text-muted-foreground">Describe the problem, solution, stage and what support you need. Never upload passwords, bank details or private identity documents.</p>
      <form onSubmit={submitOpportunity} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Opportunity title *<input required minLength={3} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="What are you building?" /></label>
        <label className={labelClass}>Industry *<input required minLength={2} maxLength={80} value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputClass} placeholder="Agriculture, fintech, education…" /></label>
        <label className={labelClass}>Stage<select value={stage} onChange={(e) => setStage(e.target.value as typeof stage)} className={inputClass}><option value="idea">Idea</option><option value="prototype">Prototype</option><option value="early_revenue">Early revenue</option><option value="growth">Growth</option><option value="established">Established</option></select></label>
        <label className={labelClass}>Funding target (optional)<span className="flex gap-2"><select aria-label="Funding currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="w-24 rounded-md border border-border bg-background px-2 py-2 text-sm"><option>MWK</option><option>USD</option><option>ZAR</option><option>GBP</option><option>EUR</option></select><input type="number" min="1" step="0.01" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Amount" className={inputClass} /></span></label>
        <label className={cn(labelClass, "sm:col-span-2")}>Pitch / description *<textarea required minLength={20} maxLength={4000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Problem, solution, target customers, traction and what you need…" className={inputClass} /></label>
        <label className={cn(labelClass, "sm:col-span-2")}>Use of funds (optional)<textarea rows={2} maxLength={1000} value={useOfFunds} onChange={(e) => setUseOfFunds(e.target.value)} placeholder="How would funding be used?" className={inputClass} /></label>
        <div className="sm:col-span-2"><button type="submit" disabled={createOpportunity.isPending} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{createOpportunity.isPending ? "Publishing…" : "Publish opportunity"}</button></div>
      </form>
    </section>
    <section><div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-semibold">Startup opportunities</h3><span className="text-xs text-muted-foreground">{opportunities.data?.filter((item) => item.status === "open").length ?? 0} open</span></div>
      {opportunities.isLoading ? <p className="py-6 text-sm text-muted-foreground">Loading opportunities…</p> : opportunities.isError ? <p role="alert" className="border border-border p-4 text-sm text-destructive">Opportunities unavailable. Apply the database migration to production Supabase.</p> : opportunities.data?.length ? <div className="grid gap-3 md:grid-cols-2">{opportunities.data.filter((item) => item.status === "open" || item.founder_id === userId).map((item) => { const founder = memberById.get(item.founder_id); const mine = item.founder_id === userId; return <article key={item.id} className="min-w-0 border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-semibold">{item.title}</h4><p className="mt-1 text-xs text-muted-foreground">{memberName(founder)} · {item.industry} · {item.stage.replaceAll("_", " ")}</p></div><span className="text-[10px] uppercase text-muted-foreground">{item.status}</span></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{item.description}</p>{item.funding_goal != null && <p className="mt-3 text-sm font-semibold">Target: {item.currency} {Number(item.funding_goal).toLocaleString()}</p>}{item.use_of_funds && <p className="mt-2 text-sm text-muted-foreground"><b>Use of funds:</b> {item.use_of_funds}</p>}<div className="mt-4 flex flex-wrap gap-2">{mine ? <><button type="button" onClick={() => changeStatus.mutate({ id: item.id, status: item.status === "open" ? "paused" : "open" })} className="border border-border px-3 py-2 text-xs hover:bg-secondary">{item.status === "open" ? "Pause listing" : "Reopen listing"}</button><button type="button" onClick={() => changeStatus.mutate({ id: item.id, status: "closed" })} disabled={item.status === "closed"} className="border border-border px-3 py-2 text-xs hover:bg-secondary disabled:opacity-50">Close</button></> : <>{acceptedIds.has(item.founder_id) ? <button type="button" onClick={() => onMessage(item.founder_id)} className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Message founder</button> : <button type="button" onClick={() => onConnect(item.founder_id)} className="border border-border px-3 py-2 text-xs hover:bg-secondary">Connect with founder</button>}</>}</div></article>; })}</div> : <div className="border border-dashed border-border px-4 py-10 text-center"><BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No startup opportunities yet</p><p className="mt-1 text-sm text-muted-foreground">Publish the first opportunity when ready. Examples are not shown as real listings.</p></div>}
    </section>
    <section><h3 className="mb-3 font-semibold">Investor directory</h3>{directory.isLoading ? <p className="text-sm text-muted-foreground">Loading member profiles…</p> : directory.isError ? <p className="text-sm text-muted-foreground">Directory unavailable until the database migration is applied.</p> : <div className="grid gap-3 md:grid-cols-2">{(directory.data ?? []).filter((item) => item.user_id !== userId && (item.role === "investor" || item.role === "both")).map((item) => { const person = memberById.get(item.user_id); return <article key={item.user_id} className="flex min-w-0 gap-3 border border-border p-4"><div className="min-w-0 flex-1"><p className="font-semibold">{item.organization_name || memberName(person)}</p><p className="mt-1 text-xs text-muted-foreground">{item.headline || item.role}{item.location ? " · " + item.location : ""}</p>{item.bio && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{item.bio}</p>}<div className="mt-3">{acceptedIds.has(item.user_id) ? <button type="button" onClick={() => onMessage(item.user_id)} className="text-xs font-medium text-primary hover:underline">Message investor</button> : <button type="button" onClick={() => onConnect(item.user_id)} className="text-xs font-medium text-primary hover:underline">Request connection</button>}</div></div></article>; })}</div>}</section>
    <p className="text-xs leading-5 text-muted-foreground">MAS does not verify funding claims or guarantee investment outcomes. Review opportunities independently. No investment or payment is processed by this feature.</p>
  </div>;
}
