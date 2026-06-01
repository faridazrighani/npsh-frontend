#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const rootDir = path.resolve(__dirname, '..');
const configPath = path.join(rootDir, 'seo.metadata.json');
const indexPath = path.join(rootDir, 'index.html');
const startMarker = '    <!-- SEO_METADATA_START -->';
const endMarker = '    <!-- SEO_METADATA_END -->';

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isProvided(value) {
  return typeof value === 'string' && value.trim() && !/\[?ISI_|ISI_|\[\[|\]\]/i.test(value);
}

function ensureAbsoluteUrl(value, label) {
  if (!isProvided(value)) return;
  const url = new URL(value);
  assert(['https:', 'http:'].includes(url.protocol), `${label} must be http(s): ${value}`);
}

function ensureNoPlaceholders(value, label = 'metadata') {
  if (typeof value === 'string') {
    assert(!/\[?ISI_|ISI_|\[\[|\]\]/i.test(value), `${label} still contains a placeholder`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => ensureNoPlaceholders(item, `${label}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => ensureNoPlaceholders(item, `${label}.${key}`));
  }
}

function htmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function attrs(attributes) {
  return Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ` ${key}="${htmlEscape(value)}"`)
    .join('');
}

function meta(attributes) {
  return `    <meta${attrs(attributes)}>`;
}

function link(attributes) {
  return `    <link${attrs(attributes)}>`;
}

function title(value) {
  return `    <title>${textEscape(value)}</title>`;
}

function ldScript(graph) {
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2)
    .replace(/</g, '\\u003c');
  return `    <script type="application/ld+json">\n${json.split('\n').map(line => `    ${line}`).join('\n')}\n    </script>`;
}

function arrayText(values) {
  return values.filter(isProvided).join(', ');
}

function semicolonText(values) {
  return values.filter(isProvided).join('; ');
}

function personId(siteUrl) {
  return `${siteUrl}#creator`;
}

function orgId(siteUrl) {
  return `${siteUrl}#organization`;
}

function imageId(siteUrl) {
  return `${siteUrl}#primaryimage`;
}

function buildStructuredData(config) {
  const { site, creator, publisher, image, article } = config;
  const siteUrl = site.canonicalUrl;
  const graph = [
    {
      '@type': ['CollegeOrUniversity', 'Organization'],
      '@id': orgId(siteUrl),
      name: publisher.name,
      url: publisher.url,
      logo: { '@id': `${siteUrl}#organization-logo` },
      department: {
        '@type': 'Organization',
        name: publisher.department,
        parentOrganization: { '@id': orgId(siteUrl) }
      }
    },
    {
      '@type': 'ImageObject',
      '@id': `${siteUrl}#organization-logo`,
      url: publisher.logoUrl,
      contentUrl: publisher.logoUrl,
      encodingFormat: 'image/webp',
      width: publisher.logoWidth,
      height: publisher.logoHeight,
      caption: `${publisher.name} logo`
    },
    {
      '@type': 'Person',
      '@id': personId(siteUrl),
      name: creator.name,
      sameAs: [creator.orcid],
      affiliation: { '@id': orgId(siteUrl) },
      worksFor: { '@id': orgId(siteUrl) },
      knowsAbout: [
        site.field,
        'Net Positive Suction Head (NPSH)',
        'Centrifugal pump cavitation',
        'Hydraulic simulation'
      ]
    },
    {
      '@type': 'ImageObject',
      '@id': imageId(siteUrl),
      url: image.url,
      contentUrl: image.url,
      encodingFormat: image.type,
      width: image.width,
      height: image.height,
      caption: image.alt
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}#website`,
      url: siteUrl,
      name: site.name,
      alternateName: site.shortName,
      description: site.description,
      inLanguage: site.languages,
      publisher: { '@id': orgId(siteUrl) },
      creator: { '@id': personId(siteUrl) },
      image: { '@id': imageId(siteUrl) }
    },
    {
      '@type': 'WebPage',
      '@id': `${siteUrl}#webpage`,
      url: siteUrl,
      name: site.title,
      headline: site.title,
      description: site.description,
      isPartOf: { '@id': `${siteUrl}#website` },
      primaryImageOfPage: { '@id': imageId(siteUrl) },
      inLanguage: site.languages,
      dateModified: site.dateModified,
      about: [
        { '@type': 'Thing', name: 'Net Positive Suction Head (NPSH)' },
        { '@type': 'Thing', name: 'Centrifugal pump cavitation potential' },
        { '@type': 'Thing', name: site.field }
      ],
      creator: { '@id': personId(siteUrl) },
      publisher: { '@id': orgId(siteUrl) },
      breadcrumb: { '@id': `${siteUrl}#breadcrumb` },
      mainEntity: { '@id': `${siteUrl}#learningresource` }
    },
    {
      '@type': 'LearningResource',
      '@id': `${siteUrl}#learningresource`,
      name: site.name,
      alternateName: site.shortName,
      url: siteUrl,
      description: site.description,
      learningResourceType: 'Interactive simulation',
      educationalUse: [
        'Simulation',
        'Engineering analysis'
      ],
      teaches: [
        'Net Positive Suction Head (NPSH) analysis',
        'Centrifugal pump cavitation potential',
        'Hydraulic route calculation'
      ],
      audience: {
        '@type': 'EducationalAudience',
        educationalRole: 'Mechanical engineering student'
      },
      inLanguage: site.languages,
      keywords: site.keywords,
      isPartOf: { '@id': `${siteUrl}#website` },
      mainEntityOfPage: { '@id': `${siteUrl}#webpage` },
      creator: { '@id': personId(siteUrl) },
      publisher: { '@id': orgId(siteUrl) },
      image: { '@id': imageId(siteUrl) }
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${siteUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: siteUrl
        }
      ]
    }
  ];

  if (isProvided(article.url)) {
    const scholarlyArticle = {
      '@type': 'ScholarlyArticle',
      '@id': `${article.url}#scholarlyarticle`,
      url: article.url,
      headline: site.title,
      name: site.title,
      description: site.description,
      inLanguage: site.languages,
      keywords: site.keywords,
      author: { '@id': personId(siteUrl) },
      publisher: { '@id': orgId(siteUrl) },
      image: { '@id': imageId(siteUrl) },
      isPartOf: { '@id': `${siteUrl}#website` }
    };
    if (isProvided(article.datePublished)) scholarlyArticle.datePublished = article.datePublished;
    if (isProvided(article.dateOnline)) scholarlyArticle.dateModified = article.dateOnline;
    if (isProvided(article.pdfUrl)) scholarlyArticle.associatedMedia = { '@type': 'MediaObject', contentUrl: article.pdfUrl, encodingFormat: 'application/pdf' };
    graph.push(scholarlyArticle);
  }

  return graph;
}

function buildSeoBlock(config) {
  const { site, creator, publisher, image, article } = config;
  const keywords = arrayText(site.keywords);
  const subject = semicolonText([
    site.field,
    'NPSH analysis',
    'centrifugal pumps',
    'cavitation potential',
    'hydraulic simulation'
  ]);

  const lines = [
    startMarker,
    meta({ charset: 'UTF-8' }),
    meta({ name: 'viewport', content: 'width=device-width, initial-scale=1.0' }),
    title(site.title),
    meta({ name: 'description', content: site.description }),
    meta({ name: 'keywords', content: keywords }),
    meta({ name: 'author', content: creator.name }),
    meta({ name: 'creator', content: creator.name }),
    meta({ name: 'publisher', content: publisher.name }),
    meta({ name: 'application-name', content: site.name }),
    meta({ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }),
    meta({ name: 'googlebot', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }),
    meta({ name: 'bingbot', content: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' }),
    meta({ name: 'referrer', content: 'strict-origin-when-cross-origin' }),
    meta({ name: 'theme-color', content: site.themeColor }),
    meta({ name: 'color-scheme', content: site.colorScheme }),
    link({ rel: 'icon', href: site.faviconUrl, type: 'image/x-icon' }),
    link({ rel: 'canonical', href: site.canonicalUrl }),
    link({ rel: 'sitemap', type: 'application/xml', title: 'Sitemap', href: site.sitemapUrl }),
    link({ rel: 'alternate', hreflang: 'x-default', href: site.canonicalUrl }),
    ...site.languages.map(language => link({ rel: 'alternate', hreflang: language, href: site.canonicalUrl })),
    meta({ property: 'og:type', content: 'website' }),
    meta({ property: 'og:site_name', content: site.name }),
    meta({ property: 'og:locale', content: site.primaryLocale }),
    ...site.alternateLocales.map(locale => meta({ property: 'og:locale:alternate', content: locale })),
    meta({ property: 'og:title', content: site.title }),
    meta({ property: 'og:description', content: site.description }),
    meta({ property: 'og:url', content: site.canonicalUrl }),
    meta({ property: 'og:image', content: image.url }),
    meta({ property: 'og:image:secure_url', content: image.url }),
    meta({ property: 'og:image:type', content: image.type }),
    meta({ property: 'og:image:width', content: image.width }),
    meta({ property: 'og:image:height', content: image.height }),
    meta({ property: 'og:image:alt', content: image.alt }),
    meta({ name: 'twitter:card', content: 'summary_large_image' }),
    meta({ name: 'twitter:title', content: site.title }),
    meta({ name: 'twitter:description', content: site.description }),
    meta({ name: 'twitter:image', content: image.url }),
    meta({ name: 'twitter:image:alt', content: image.alt }),
    isProvided(article.url) ? meta({ name: 'article:author', content: creator.name }) : null,
    isProvided(article.url) ? meta({ name: 'article:publisher', content: publisher.name }) : null,
    isProvided(article.url) ? meta({ name: 'article:section', content: site.field }) : null,
    isProvided(article.url) ? meta({ name: 'article:tag', content: 'NPSH' }) : null,
    isProvided(article.url) ? meta({ name: 'article:tag', content: 'centrifugal pump' }) : null,
    isProvided(article.url) ? meta({ name: 'article:tag', content: 'cavitation' }) : null,
    meta({ name: 'dc.title', content: site.title }),
    meta({ name: 'dc.creator', content: creator.name }),
    meta({ name: 'dc.subject', content: subject }),
    meta({ name: 'dc.description', content: site.description }),
    meta({ name: 'dc.publisher', content: publisher.name }),
    meta({ name: 'dc.type', content: 'InteractiveResource' }),
    meta({ name: 'dc.format', content: 'text/html' }),
    meta({ name: 'dc.identifier', content: site.canonicalUrl }),
    meta({ name: 'dc.source', content: site.canonicalUrl }),
    meta({ name: 'dc.language', content: site.languages.join(', ') }),
    meta({ name: 'dc.rights', content: site.rights }),
    meta({ name: 'dc.date', content: site.date }),
    meta({ name: 'dc.modified', content: site.dateModified }),
    meta({ name: 'citation_title', content: site.title }),
    meta({ name: 'citation_author', content: creator.name }),
    meta({ name: 'citation_language', content: site.languages.join(', ') }),
    meta({ name: 'citation_publisher', content: publisher.name }),
    meta({ name: 'citation_keywords', content: keywords }),
    meta({ name: 'citation_technical_report_institution', content: publisher.name }),
    isProvided(article.datePublished) ? meta({ name: 'citation_publication_date', content: article.datePublished }) : null,
    isProvided(article.dateOnline) ? meta({ name: 'citation_online_date', content: article.dateOnline }) : null,
    isProvided(article.pdfUrl) ? meta({ name: 'citation_pdf_url', content: article.pdfUrl }) : null,
    ldScript(buildStructuredData(config)),
    endMarker
  ].filter(Boolean);

  return `${lines.join('\n')}\n`;
}

function validateConfig(config) {
  ensureNoPlaceholders(config);
  ensureAbsoluteUrl(config.site.url, 'site.url');
  ensureAbsoluteUrl(config.site.canonicalUrl, 'site.canonicalUrl');
  ensureAbsoluteUrl(config.site.faviconUrl, 'site.faviconUrl');
  ensureAbsoluteUrl(config.site.sitemapUrl, 'site.sitemapUrl');
  ensureAbsoluteUrl(config.creator.orcid, 'creator.orcid');
  ensureAbsoluteUrl(config.publisher.url, 'publisher.url');
  ensureAbsoluteUrl(config.publisher.logoUrl, 'publisher.logoUrl');
  ensureAbsoluteUrl(config.image.url, 'image.url');
  ensureAbsoluteUrl(config.article.url, 'article.url');
  ensureAbsoluteUrl(config.article.pdfUrl, 'article.pdfUrl');

  assert(config.site.canonicalUrl.endsWith('/'), 'canonical URL should end with /');
  assert(config.site.languages.includes('en') && config.site.languages.includes('id'), 'languages must include en and id');
  assert(Number.isInteger(config.image.width) && config.image.width > 0, 'image.width must be a positive integer');
  assert(Number.isInteger(config.image.height) && config.image.height > 0, 'image.height must be a positive integer');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(config.site.dateModified), 'site.dateModified must use YYYY-MM-DD');
}

function validateRenderedHtml(html) {
  const count = pattern => (html.match(pattern) || []).length;
  assert.strictEqual(count(/<title>/g), 1, 'Exactly one <title> is required');
  assert.strictEqual(count(/name="description"/g), 1, 'Exactly one meta description is required');
  assert.strictEqual(count(/rel="canonical"/g), 1, 'Exactly one canonical link is required');
  assert.strictEqual(count(/type="application\/ld\+json"/g), 1, 'Exactly one JSON-LD block is required');

  const ldMatch = html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
  assert(ldMatch, 'JSON-LD block is missing');
  const parsed = JSON.parse(ldMatch[1]);
  assert.strictEqual(parsed['@context'], 'https://schema.org', 'JSON-LD context must be schema.org');
  assert(Array.isArray(parsed['@graph']) && parsed['@graph'].length >= 7, 'JSON-LD graph is incomplete');
  const learningResource = parsed['@graph'].find(entry => entry['@id'] === 'https://npsh.virsim.id/#learningresource');
  assert(learningResource, 'LearningResource JSON-LD node is missing');
  assert.strictEqual(learningResource['@type'], 'LearningResource', 'Academic simulation JSON-LD should avoid SoftwareApplication rich-result rating warnings.');
  assert.strictEqual(learningResource.learningResourceType, 'Interactive simulation', 'LearningResource should describe the app as an interactive simulation.');
  assert(Array.isArray(learningResource.teaches) && learningResource.teaches.includes('Net Positive Suction Head (NPSH) analysis'), 'LearningResource should teach NPSH analysis.');
  assert(!parsed['@graph'].some(entry => entry['@id'] === 'https://npsh.virsim.id/#webapplication'), 'Software app rich-result node should stay removed until real public ratings/reviews exist.');
  assert(!Object.prototype.hasOwnProperty.call(learningResource, 'aggregateRating'), 'Do not publish aggregateRating without real public ratings.');
  assert(!Object.prototype.hasOwnProperty.call(learningResource, 'review'), 'Do not publish review without real public reviews.');
}

function renderIndex(original, seoBlock) {
  if (original.includes(startMarker) && original.includes(endMarker)) {
    const pattern = new RegExp(`${startMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${endMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`);
    return original.replace(pattern, seoBlock);
  }

  const headOpen = original.indexOf('<head>');
  assert(headOpen !== -1, 'index.html is missing <head>');
  const headStart = original.indexOf('\n', headOpen);
  const anchorMatch = original.match(/\n\s*<noscript><link rel="stylesheet"/);
  assert(anchorMatch, 'Could not find stylesheet anchor in <head>');
  return `${original.slice(0, headStart + 1)}${seoBlock}${original.slice(anchorMatch.index + 1)}`;
}

const config = readJson(configPath);
validateConfig(config);

const original = fs.readFileSync(indexPath, 'utf8');
const nextHtml = renderIndex(original, buildSeoBlock(config));
validateRenderedHtml(nextHtml);

if (checkOnly) {
  assert.strictEqual(original, nextHtml, 'index.html SEO metadata is not in sync with seo.metadata.json');
  console.log('SEO metadata is in sync.');
} else {
  fs.writeFileSync(indexPath, nextHtml);
  console.log('Rendered SEO metadata into index.html.');
}
