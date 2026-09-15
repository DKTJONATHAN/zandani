#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 SEO RECOVERY AUDIT STARTED\n');

// 1. Check for noindex/nofollow in build output
console.log('1️⃣ Checking for noindex/nofollow in HTML files...');
const distDir = path.join(__dirname, '../dist');
if (fs.existsSync(distDir)) {
  const checkFiles = (dir, ext = '.html') => {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith(ext))
      .map(f => path.join(dir, f));
  };

  const htmlFiles = checkFiles(distDir);
  let noindexFound = false;

  htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('noindex') || content.includes('nofollow')) {
      console.log(`   ⚠️  CRITICAL: Found noindex/nofollow in ${path.relative(distDir, file)}`);
      noindexFound = true;
    }
  });

  if (!noindexFound) {
    console.log('   ✅ No noindex/nofollow tags found');
  }
} else {
  console.log('   ⚠️  /dist directory not found. Run build first.');
}

// 2. Verify sitemap generation script exists
console.log('\n2️⃣ Checking SEO script configuration...');
const seoScript = path.join(__dirname, 'generate-seo.js');
if (fs.existsSync(seoScript)) {
  console.log('   ✅ generate-seo.js exists');
} else {
  console.log('   ❌ CRITICAL: generate-seo.js MISSING!');
}

// 3. Check robots.txt
console.log('\n3️⃣ Verifying robots.txt...');
const robotsFiles = [
  path.join(__dirname, '../robots.txt'),
  path.join(__dirname, '../public/robots.txt')
];

robotsFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes('Disallow: /')) {
      console.log(`   ⚠️  WARNING: robots.txt at ${file} has Disallow rules`);
    }
    if (content.includes('Sitemap:')) {
      console.log(`   ✅ ${file} has sitemap references`);
    } else {
      console.log(`   ❌ ${file} MISSING sitemap references!`);
    }
  }
});

// 4. Check Cloudflare edge headers (public/_headers)
console.log('\n4️⃣ Checking Cloudflare cache headers (public/_headers)...');
const headersFile = path.join(__dirname, '../public/_headers');
if (fs.existsSync(headersFile)) {
  const content = fs.readFileSync(headersFile, 'utf-8');
  if (content.includes('max-age=0') && content.includes('Cache-Control')) {
    console.log('   ⚠️  WARNING: Found max-age=0 in Cache-Control');
    console.log('      Prefer public, max-age=3600 (or longer) for HTML that should be cached');
  } else {
    console.log('   ✅ public/_headers present');
  }
} else {
  console.log('   ⚠️  public/_headers not found');
}

// 5. Verify article frontmatter has no noindex
console.log('\n5️⃣ Spot-checking article frontmatter...');
const postsDir = path.join(__dirname, '../content/posts');
if (fs.existsSync(postsDir)) {
  const articles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md')).slice(0, 5);
  let issuesFound = 0;
  
  articles.forEach(article => {
    const content = fs.readFileSync(path.join(postsDir, article), 'utf-8');
    if (content.includes('noindex') || content.includes('robots:')) {
      console.log(`   ⚠️  ${article} has robots metadata`);
      issuesFound++;
    }
  });
  
  if (issuesFound === 0) {
    console.log(`   ✅ Checked ${articles.length} articles - no noindex found`);
  }
}

// 6. Generate recovery recommendations
console.log('\n' + '='.repeat(60));
console.log('📋 RECOVERY CHECKLIST:\n');

const checklist = [
  {
    priority: 'CRITICAL',
    task: 'Verify Google Search Console',
    action: 'Check for manual actions or coverage issues at https://search.google.com/search-console'
  },
  {
    priority: 'CRITICAL',
    task: 'Check inject-meta.js script',
    action: 'Ensure scripts/inject-meta.js is NOT adding noindex meta tags'
  },
  {
    priority: 'HIGH',
    task: 'Fix Cache-Control headers',
    action: 'Review public/_headers and Cloudflare cache rules'
  },
  {
    priority: 'HIGH',
    task: 'Verify sitemaps generate',
    action: 'Ensure /sitemap.xml and /news-sitemap.xml are accessible and valid'
  },
  {
    priority: 'MEDIUM',
    task: 'Submit new sitemap to Google',
    action: 'Go to Search Console > Sitemaps > Submit https://zandani.co.ke/sitemap.xml'
  },
  {
    priority: 'MEDIUM',
    task: 'Check canonical URLs',
    action: 'Ensure all pages have correct canonical tags pointing to your domain'
  },
  {
    priority: 'LOW',
    task: 'Monitor indexing',
    action: 'Use Search Console to request re-indexing of important pages'
  }
];

checklist.forEach((item, idx) => {
  const icon = item.priority === 'CRITICAL' ? '🔴' : item.priority === 'HIGH' ? '🟠' : item.priority === 'MEDIUM' ? '🟡' : '🟢';
  console.log(`${icon} [${item.priority}] ${idx + 1}. ${item.task}`);
  console.log(`   → ${item.action}\n`);
});

console.log('='.repeat(60));
console.log('\n✅ Audit complete. Review findings above.\n');
