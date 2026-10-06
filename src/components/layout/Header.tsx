import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Search, Radio, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchOverlay } from "@/components/SearchOverlay";
import { getAllPosts } from "@/lib/markdown";
import { primaryNavLinks } from "@/lib/site-links";
import logoImg from "@/assets/logo.png";

const allPostsFromMarkdown = getAllPosts();

export function Header() {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const trendingPosts = useMemo(() => allPostsFromMarkdown.slice(0, 5), []);

  return (
    <>
      <div className="brand-bar" />
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-divider safe-top">
        <div className="hidden md:block border-b border-divider">
          <div className="container max-w-7xl mx-auto px-4 flex items-center gap-3 py-1.5 text-[11px]">
            <span className="flex items-center gap-2 shrink-0 font-bold uppercase tracking-[.18em] text-primary"><span className="live-dot"/>Live Desk</span>
            <div className="flex-1 overflow-hidden relative">
              <div className="animate-header-marquee flex gap-8 w-max">
                {[...trendingPosts,...trendingPosts].map((post,i)=><Link key={post.slug+i} to={"/article/"+post.slug} className="shrink-0 text-muted-foreground hover:text-primary whitespace-nowrap">{post.title}</Link>)}
              </div>
            </div>
            <span className="shrink-0 text-muted-foreground uppercase tracking-widest">Kenya · East Africa</span>
          </div>
        </div>
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <Link to="/" className="shrink-0 group flex items-end gap-3">
              <img src={logoImg} alt="Za Ndani" className="h-10 w-10 object-cover rounded-none md:h-12 md:w-auto" loading="eager" width={48} height={48}/>
              <div>
                <div className="font-serif font-bold text-[1.45rem] leading-none tracking-[-.04em]">Za Ndani</div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-[.2em] text-muted-foreground">Independent Kenya Newsroom</div>
              </div>
            </Link>
            <nav className="hidden lg:flex items-center gap-0 border-x border-divider px-2" aria-label="Primary">
              {primaryNavLinks.map(link=><Link key={link.path} to={link.path} className="px-3 py-2 text-[12px] font-bold uppercase tracking-[.07em] text-muted-foreground hover:text-primary transition-colors">{link.label}</Link>)}
            </nav>
            <div className="flex items-center gap-1">
              <form className="hidden xl:flex items-center border-b border-divider px-1 py-1" onSubmit={e=>{e.preventDefault();const q=searchQuery.trim();q?navigate("/search?q="+encodeURIComponent(q)):setIsSearchOpen(true)}} role="search">
                <Search className="w-4 h-4 text-muted-foreground mr-2"/><input type="search" value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search the newsroom" aria-label="Search articles" className="bg-transparent outline-none text-xs w-40"/>
              </form>
              <Button variant="ghost" size="icon" onClick={()=>setIsSearchOpen(true)} className="h-10 w-10 rounded-none hover:bg-primary/10 hover:text-primary" aria-label="Search"><Search className="w-5 h-5"/></Button>
              <Link to="/newsletter" className="hidden md:inline-flex items-center gap-1.5 border border-primary px-3 h-9 text-[10px] font-bold uppercase tracking-[.12em] text-primary hover:bg-primary hover:text-primary-foreground"><Mail className="w-3.5 h-3.5"/>Briefing</Link>
              <Link to="/tv" className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground px-3.5 h-9 text-[10px] font-bold uppercase tracking-[.12em]"><Radio className="w-3.5 h-3.5"/>Live TV</Link>
              <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10 rounded-none hover:bg-primary/10" onClick={()=>setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu" aria-expanded={isMenuOpen}>{isMenuOpen?<X className="w-5 h-5"/>:<Menu className="w-5 h-5"/>}</Button>
            </div>
          </div>
        </div>
        {isMenuOpen && <nav className="lg:hidden border-t border-divider bg-background animate-fade-in" aria-label="Mobile"><div className="container max-w-7xl mx-auto px-4 py-2 pb-5">{primaryNavLinks.map(link=><Link key={link.path} to={link.path} className="block border-b border-divider py-3.5 text-sm font-bold uppercase tracking-wider" onClick={()=>setIsMenuOpen(false)}>{link.label}</Link>)}<div className="grid grid-cols-2 gap-2 pt-3"><Link to="/newsletter" onClick={()=>setIsMenuOpen(false)} className="border border-primary px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-primary"><Mail className="inline w-4 h-4 mr-1"/>Briefing</Link><Link to="/tv" onClick={()=>setIsMenuOpen(false)} className="bg-primary px-3 py-3 text-center text-xs font-bold uppercase tracking-wider text-primary-foreground"><Radio className="inline w-4 h-4 mr-1"/>Live TV</Link></div></div></nav>}
      </header>
      <SearchOverlay isOpen={isSearchOpen} onClose={()=>setIsSearchOpen(false)}/>
      <style dangerouslySetInnerHTML={{__html:`@keyframes headerMarquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}.animate-header-marquee{animation:headerMarquee 40s linear infinite}@media(prefers-reduced-motion:reduce){.animate-header-marquee{animation:none}}`}}/>
    </>
  );
}
