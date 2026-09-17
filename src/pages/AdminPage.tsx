import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { getAllPosts, getPostBySlug, PostMetadata, Post, categories as defaultCategories } from "@/lib/markdown";
import {
  Lock, Plus, Eye, FileText, LogOut, Loader2, Pencil, Trash2,
  Github, Search, Users, TrendingUp, BarChart2, Flame,
  ArrowUp, ArrowDown, Clock, Zap, BookOpen, AlarmClock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthorsManager } from "@/admin/components/AuthorsManager";
import { AuthorProfile } from "@/admin/types";
import { validatePin, isAdminAuthenticated, setAdminAuthenticated } from "@/admin/utils/auth";
import {
  getGithubFileContent, getGithubFileSha,
  pushToGithub, deleteFromGithub,
} from "@/admin/utils/github";
import { generateSlug } from "@/admin/utils/helpers";
import { ConfirmDialog } from "@/admin/components/ConfirmDialog";
import { SchedulerPanel } from "@/admin/components/SchedulerPanel";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function catColor(_cat: string): string {
  return "bg-primary text-primary-foreground";
}

function proxyImg(url: string, w = 300): string {
  if (!url) return "/images/placeholder.jpg";
  if (url.endsWith(".svg") || url.startsWith("/")) return url;
  return `https://wsrv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ""))}&w=${w}&output=webp&q=75&we`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

type Tab = "dashboard" | "create" | "manage" | "authors" | "scheduler";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [posts, setPosts] = useState<PostMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const [viewCounts, setViewCounts] = useState<Record<string, number>>({});
  const [viewsLoading, setViewsLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<PostMetadata | null>(null);
  const [categories, setCategories] = useState<{ name: string; slug: string }[]>([]);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [authors, setAuthors] = useState<Record<string, AuthorProfile>>({});
  const [isCustomAuthor, setIsCustomAuthor] = useState(false);
  const [newPost, setNewPost] = useState({
    title: "", slug: "", excerpt: "", category: "News", content: "",
    image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800",
    author: "Za Ndani", tags: ""
  });
  const [inlineAuthor, setInlineAuthor] = useState<AuthorProfile>({
    name: "", role: "Contributing Writer", bio: "", avatar: "",
    location: "Kenya", socials: { twitter: "", linkedin: "", email: "" }
  });

  useEffect(() => {
    if (isAdminAuthenticated()) { setIsAuthenticated(true); loadData(); }
  }, []);

  async function loadData() {
    setPosts(getAllPosts());
    setViewsLoading(true);
    try {
      const res = await fetch('/api/get-views');
      if (res.ok) setViewCounts(await res.json());
    } catch {}
    setViewsLoading(false);
    const catJson = await getGithubFileContent('content/categories.json');
    if (catJson) { try { setCategories(JSON.parse(catJson)); } catch { setCategories(defaultCategories); } }
    else setCategories(defaultCategories);
    const authJson = await getGithubFileContent('content/authors.json');
    if (authJson) { try { setAuthors(JSON.parse(authJson)); } catch { setAuthors({}); } }
  }

  const postsWithViews = useMemo(() =>
    posts.map(post => {
      const clean = post.slug.replace(/^\//, '').replace(/\.md$/, '');
      const v = viewCounts[`/article/${clean}`] || viewCounts[`/article/${clean}/`] || 0;
      return { ...post, views: v > 0 ? v : 0 };
    }),
    [posts, viewCounts]
  );

  const analytics = useMemo(() => {
    const totalViews = postsWithViews.reduce((s, p) => s + p.views, 0);
    const topPosts = [...postsWithViews].sort((a, b) => b.views - a.views).slice(0, 5);
    const byCategory: Record<string, { count: number; views: number }> = {};
    postsWithViews.forEach(p => {
      const cat = p.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = { count: 0, views: 0 };
      byCategory[cat].count++;
      byCategory[cat].views += p.views;
    });
    const catStats = Object.entries(byCategory).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.views - a.views);
    const byAuthor: Record<string, { count: number; views: number }> = {};
    postsWithViews.forEach(p => {
      const a = p.author || "Unknown";
      if (!byAuthor[a]) byAuthor[a] = { count: 0, views: 0 };
      byAuthor[a].count++;
      byAuthor[a].views += p.views;
    });
    const authorStats = Object.entries(byAuthor).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.views - a.views);
    const sevenDaysAgo = Date.now() - 7 * 86400000;
    const recentCount = posts.filter(p => new Date(p.date).getTime() > sevenDaysAgo).length;
    const noTraction = postsWithViews.filter(p => p.views === 0).slice(0, 5);
    return { totalViews, topPosts, catStats, authorStats, recentCount, noTraction };
  }, [postsWithViews]);

  useEffect(() => {
    if (newPost.category && !categories.some(c => c.name === newPost.category)) setIsCustomCategory(true);
    else setIsCustomCategory(false);
  }, [newPost.category, categories]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (validatePin(pin)) {
      setIsAuthenticated(true); setAdminAuthenticated(true); loadData(); setPinError("");
    } else { setPinError("Invalid PIN. Try again."); setPin(""); }
  };

  const handleLogout = () => {
    setIsAuthenticated(false); setAdminAuthenticated(false);
    setActiveTab("dashboard"); resetPostForm();
  };

  const submitToIndexNow = async (slug: string) => {
    try { await supabase.functions.invoke('index-now', { body: { urls: [`/article/${slug}`] } }); } catch {}
  };

  const handlePublish = async (isUpdate: boolean) => {
    if (!newPost.title || !newPost.content) {
      toast({ title: "Missing fields", description: "Title and content are required.", variant: "destructive" });
      return;
    }
    setIsPublishing(true);
    let finalAuthorName = newPost.author;
    try {
      if (isCustomAuthor && inlineAuthor.name) {
        finalAuthorName = inlineAuthor.name;
        const updatedAuthors = { ...authors, [inlineAuthor.name]: inlineAuthor };
        const sha = await getGithubFileSha('content/authors.json');
        await pushToGithub('content/authors.json', JSON.stringify(updatedAuthors, null, 2), `Add author: ${inlineAuthor.name}`, sha || undefined);
        setAuthors(updatedAuthors);
      }
      if (newPost.category && !categories.some(c => c.name === newPost.category)) {
        const newSlug = generateSlug(newPost.category);
        const newCats = [...categories, { name: newPost.category, slug: newSlug }];
        const sha = await getGithubFileSha('content/categories.json');
        await pushToGithub('content/categories.json', JSON.stringify(newCats, null, 2), `Add category: ${newPost.category}`, sha);
        setCategories(newCats);
      }
      const postSlug = newPost.slug || generateSlug(newPost.title);
      const filePath = `content/posts/${postSlug}.md`;
      const tagsFormatted = (newPost.tags || "").split(',').map(t => t.trim()).filter(Boolean).join(', ');
      const markdown = `---\ntitle: "${newPost.title}"\nslug: "${postSlug}"\nexcerpt: "${newPost.excerpt}"\nauthor: "${finalAuthorName}"\nimage: "${newPost.image}"\ncategory: "${newPost.category}"\ndate: "${editingPost?.date || new Date().toISOString().split('T')[0]}"\ntags: [${tagsFormatted}]\n---\n\n${newPost.content}`;
      if (isUpdate && editingPost && editingPost.slug !== postSlug) {
        const oldSha = await getGithubFileSha(`content/posts/${editingPost.slug}.md`);
        if (oldSha) await deleteFromGithub(`content/posts/${editingPost.slug}.md`, `Delete old slug`, oldSha);
      }
      const sha = await getGithubFileSha(filePath);
      await pushToGithub(filePath, markdown, `${isUpdate ? 'Update' : 'Publish'}: ${newPost.title}`, sha);
      await submitToIndexNow(postSlug);
      toast({ title: "Published!", description: "Story is live on Za Ndani." });
      resetPostForm(); loadData();
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally { setIsPublishing(false); }
  };

  const confirmDeletePost = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    const post = posts.find(p => p.slug === showDeleteConfirm);
    if (!post) return;
    try {
      const sha = await getGithubFileSha(`content/posts/${post.slug}.md`);
      if (sha) { await deleteFromGithub(`content/posts/${post.slug}.md`, `Delete: ${post.title}`, sha); toast({ title: "Deleted" }); loadData(); }
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } finally { setShowDeleteConfirm(null); setIsDeleting(false); }
  };

  const resetPostForm = () => {
    setNewPost({ title: "", slug: "", excerpt: "", category: "News", content: "",
      image: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800", author: "Za Ndani", tags: "" });
    setEditingPost(null); setIsCustomAuthor(false);
    setInlineAuthor({ name: "", role: "Contributing Writer", bio: "", avatar: "", location: "Kenya", socials: { twitter: "", linkedin: "", email: "" } });
  };

  const handleEditPost = async (post: PostMetadata) => {
    setEditingPost(post);
    const fullPost = await getPostBySlug(post.slug);
    setNewPost({ title: post.title||"", slug: post.slug||"", excerpt: post.excerpt||"", category: post.category||"News",
      content: fullPost?.content || "", image: post.image||"", author: post.author||"Za Ndani", tags: post.tags?.join(", ")||"" });
    setIsCustomAuthor(false); setActiveTab("create");
  };

  const filteredPosts = useMemo(() =>
    postsWithViews
      .filter(p => {
        const s = searchTerm.toLowerCase();
        return (p.title||"").toLowerCase().includes(s) || (p.category||"").toLowerCase().includes(s);
      })
      .filter(p => filterCategory === "All" || p.category === filterCategory)
      .sort((a, b) => new Date(b.date||0).getTime() - new Date(a.date||0).getTime()),
    [postsWithViews, searchTerm, filterCategory]
  );

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-zinc-950">
          <div className="bg-zinc-900 border border-zinc-800 p-10 max-w-sm w-full mx-4">
            <div className="h-1 w-full bg-primary mb-8" />
            <div className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-primary flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-black text-lg leading-none">Za Ndani</p>
                <p className="text-zinc-500 text-xs uppercase tracking-widest">Admin Dashboard</p>
              </div>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-widest text-zinc-500 block mb-2">Enter PIN</label>
                <input type="password" value={pin} onChange={e => setPin(e.target.value)}
                  className="w-full px-4 py-4 bg-zinc-800 border border-zinc-700 text-white text-center text-3xl font-mono tracking-[0.5em] focus:border-primary outline-none transition-colors"
                  maxLength={4} autoFocus />
              </div>
              {pinError && <p className="text-primary text-xs text-center font-bold">{pinError}</p>}
              <button type="submit"
                className="w-full py-4 bg-primary text-white font-black uppercase tracking-wider text-sm hover:opacity-90 transition-opacity">
                Unlock Dashboard
              </button>
            </form>
          </div>
        </div>
      </Layout>
    );
  }

  const navItems: { tab: Tab; icon: React.ReactNode; label: string; badge?: string }[] = [
    { tab: "dashboard", icon: <BarChart2 className="w-4 h-4" />, label: "Dashboard" },
    { tab: "create",    icon: <Plus className="w-4 h-4" />,      label: editingPost ? "Editing Post" : "New Story" },
    { tab: "manage",    icon: <FileText className="w-4 h-4" />,   label: "All Posts", badge: String(posts.length) },
    { tab: "authors",   icon: <Users className="w-4 h-4" />,      label: "Authors",   badge: String(Object.keys(authors).length) },
    { tab: "scheduler", icon: <AlarmClock className="w-4 h-4" />, label: "Scheduler" },
  ];

  return (
    <Layout>
      <div className="flex min-h-screen bg-zinc-950">
        <div className="w-64 border-r border-zinc-800 bg-zinc-950 hidden lg:flex flex-col flex-shrink-0">
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-black leading-none">Za Ndani</p>
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest">CMS</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(item => (
              <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                  activeTab === item.tab
                    ? "bg-primary text-white font-black"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800"
                }`}>
                <span className="flex items-center gap-3">{item.icon}{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] font-black px-2 py-0.5 ${activeTab === item.tab ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-500"}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-zinc-800">
            <button onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-20 bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-white font-black text-lg capitalize">
                {activeTab === "dashboard" ? "Analytics Dashboard" :
                 activeTab === "create" ? (editingPost ? `Editing: ${editingPost.title?.slice(0,30)}…` : "New Story") :
                 activeTab === "manage" ? "Manage Posts" :
                 activeTab === "scheduler" ? "Desk Scheduler" : "Authors"}
              </h1>
              <p className="text-zinc-600 text-xs">
                {viewsLoading ? "Loading analytics..." : `${posts.length} posts · ${(analytics.totalViews / 1000).toFixed(1)}k total views`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex lg:hidden gap-1">
                {navItems.map(item => (
                  <button key={item.tab} onClick={() => setActiveTab(item.tab)}
                    className={`p-2 transition-colors ${activeTab === item.tab ? "text-primary" : "text-zinc-500"}`}>
                    {item.icon}
                  </button>
                ))}
              </div>
              <button onClick={() => loadData()}
                className="hidden lg:flex items-center gap-2 px-3 py-2 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 text-xs font-black uppercase tracking-wider transition-colors">
                Refresh
              </button>
              <button onClick={handleLogout} className="lg:hidden p-2 text-zinc-500 hover:text-white">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === "scheduler" && (
              <SchedulerPanel />
            )}

            {activeTab === "authors" && (
              <AuthorsManager onAuthorsLoaded={setAuthors} />
            )}

            {activeTab === "dashboard" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 p-5">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Posts</p>
                    <p className="text-white text-3xl font-black mt-1">{posts.length}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Total views</p>
                    <p className="text-white text-3xl font-black mt-1">{(analytics.totalViews / 1000).toFixed(1)}k</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Last 7 days</p>
                    <p className="text-white text-3xl font-black mt-1">{analytics.recentCount}</p>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5">
                    <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Authors</p>
                    <p className="text-white text-3xl font-black mt-1">{Object.keys(authors).length}</p>
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-5">
                  <p className="text-white font-black text-sm uppercase tracking-widest mb-4">Top posts</p>
                  <div className="space-y-2">
                    {analytics.topPosts.map((p, i) => (
                      <div key={p.slug} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2">
                        <span className="text-zinc-300 truncate pr-4">{i + 1}. {p.title}</span>
                        <span className="text-zinc-500 font-mono text-xs">{p.views}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "create" && (
              <div className="max-w-3xl space-y-4">
                <input className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3" placeholder="Title"
                  value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })} />
                <textarea className="w-full bg-zinc-900 border border-zinc-800 text-white px-4 py-3 min-h-[240px]" placeholder="Markdown content"
                  value={newPost.content} onChange={e => setNewPost({ ...newPost, content: e.target.value })} />
                <div className="flex gap-3">
                  <button disabled={isPublishing} onClick={() => handlePublish(!!editingPost)}
                    className="px-6 py-3 bg-primary text-white font-black uppercase text-xs tracking-wider disabled:opacity-50">
                    {isPublishing ? "Publishing…" : editingPost ? "Update" : "Publish"}
                  </button>
                  {editingPost && (
                    <button onClick={resetPostForm} className="px-6 py-3 border border-zinc-700 text-zinc-400 text-xs font-black uppercase tracking-wider">
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "manage" && (
              <div className="space-y-4">
                <div className="flex gap-3">
                  <input className="flex-1 bg-zinc-900 border border-zinc-800 text-white px-4 py-2 text-sm" placeholder="Search posts…"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="space-y-2">
                  {filteredPosts.slice(0, 50).map(p => (
                    <div key={p.slug} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-white text-sm font-bold truncate">{p.title}</p>
                        <p className="text-zinc-600 text-xs">{p.category} · {timeAgo(p.date)}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => handleEditPost(p)} className="p-2 text-zinc-400 hover:text-white"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => setShowDeleteConfirm(p.slug)} className="p-2 text-zinc-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!showDeleteConfirm}
        onOpenChange={(o) => !o && setShowDeleteConfirm(null)}
        title="Delete post?"
        description="This removes the markdown file from the repository."
        onConfirm={confirmDeletePost}
        loading={isDeleting}
      />
    </Layout>
  );
}
