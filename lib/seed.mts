import './loadEnv.mts';
import { connectToDatabase } from './mongodb.js';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

export async function isDatabaseEmpty(db: import('mongodb').Db) {
  const articleCount = await db.collection('articles').countDocuments({}, { limit: 1 });
  const categoryCount = await db.collection('categories').countDocuments({}, { limit: 1 });
  const userCount = await db.collection('users').countDocuments({}, { limit: 1 });
  return articleCount === 0 && categoryCount === 0 && userCount === 0;
}

async function seedDatabase(force = false) {
  console.log('🌱 Starting database seed...');
  
  try {
    const { db } = await connectToDatabase();

    const empty = await isDatabaseEmpty(db);

    if (!empty && !force) {
      console.log('⏭️  Database already has data. Use --force to re-seed.');
      console.log(`\n📊 Existing data summary:`);
      const articleCount = await db.collection('articles').countDocuments();
      const categoryCount = await db.collection('categories').countDocuments();
      const userCount = await db.collection('users').countDocuments();
      console.log(`   - ${articleCount} articles`);
      console.log(`   - ${categoryCount} categories`);
      console.log(`   - ${userCount} users`);
      console.log(`\n💡 Run with --force to clear and re-seed: npm run seed -- --force`);
      return;
    }

    if (force) {
      console.log('🗑️ Force mode: clearing existing data...');
      await db.collection('articles').deleteMany({});
      await db.collection('categories').deleteMany({});
      await db.collection('users').deleteMany({});
      await db.collection('tags').deleteMany({});
      console.log('✅ Database cleared');
    }
    
    // Create users with different roles
    const seedUsers = [
      {
        name: 'Superuser',
        email: 'superuser@techhub.example.com',
        role: 'superuser' as const,
        avatar: '',
        bio: 'System super administrator with full access',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Admin',
        email: 'admin@techhub.example.com',
        role: 'admin' as const,
        avatar: '',
        bio: 'Administrator with full access to content management',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Editor',
        email: 'editor@techhub.example.com',
        role: 'editor' as const,
        avatar: '',
        bio: 'Editor with content review and publishing permissions',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Author',
        email: 'author@techhub.example.com',
        role: 'author' as const,
        avatar: '',
        bio: 'Content author with article creation permissions',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'User',
        email: 'user@techhub.example.com',
        role: 'user' as const,
        avatar: '',
        bio: 'Regular user with basic access',
        passwordHash: await bcrypt.hash('password123', 10),
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];
    
    const userIds: Record<string, ObjectId> = {};
    
    for (const user of seedUsers) {
      const result = await db.collection('users').insertOne(user);
      userIds[user.email] = result.insertedId!;
      console.log(`✅ ${user.role} user created (${user.email})`);
    }
    
    const adminId = userIds['admin@techhub.example.com'];
    const authorId = userIds['author@techhub.example.com'];
    
    // Create categories matching the GlobalNav structure
    const categories = [
      // Main categories (top-level navigation)
      {
        name: 'Reviews',
        slug: 'reviews',
        description: 'In-depth reviews of phones, laptops, tablets, and wearables.',
        icon: 'PhoneIcon',
        color: 'bg-blue-500',
        parentCategory: null,
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Tech Tutorials',
        slug: 'tech-tutorials',
        description: 'Learn programming, machine learning, data science, web development, and DevOps.',
        icon: 'CodeIcon',
        color: 'bg-purple-500',
        parentCategory: null,
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Life Skills',
        slug: 'life-skills',
        description: 'Practical training in tailoring, hair dressing, ironing, cooking, and home maintenance.',
        icon: 'ScissorsIcon',
        color: 'bg-green-500',
        parentCategory: null,
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Blog',
        slug: 'blog',
        description: 'Latest articles, tech news, and guides to keep you updated.',
        icon: 'ArticleIcon',
        color: 'bg-amber-500',
        parentCategory: null,
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'GeoPolitics',
        slug: 'geopolitics',
        description: 'News, climate changes, and green energy discussions.',
        icon: 'NewsIcon',
        color: 'bg-red-500',
        parentCategory: null,
        featured: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      
      // Subcategories for Reviews (from GlobalNav)
      {
        name: 'Phones',
        slug: 'phones',
        description: 'Smartphone reviews and comparisons.',
        icon: 'PhoneIcon',
        color: 'bg-blue-400',
        parentCategory: null, // Will be set after parent is created
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Laptops',
        slug: 'laptops',
        description: 'Laptop reviews and buying guides.',
        icon: 'LaptopIcon',
        color: 'bg-blue-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Tablets',
        slug: 'tablets',
        description: 'Tablet reviews and accessories.',
        icon: 'TabletIcon',
        color: 'bg-blue-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Wearables',
        slug: 'wearables',
        description: 'Smartwatches and fitness trackers.',
        icon: 'WatchIcon',
        color: 'bg-blue-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      
      // Subcategories for Tech Tutorials
      {
        name: 'Programming',
        slug: 'programming',
        description: 'Learn programming languages and concepts.',
        icon: 'CodeIcon',
        color: 'bg-purple-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Machine Learning',
        slug: 'machine-learning',
        description: 'AI and machine learning tutorials.',
        icon: 'BrainIcon',
        color: 'bg-purple-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Data Science & Analytics',
        slug: 'data-science-analytics',
        description: 'Data analysis and visualization techniques.',
        icon: 'ChartIcon',
        color: 'bg-purple-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Web Development',
        slug: 'web-development',
        description: 'Frontend and backend web development.',
        icon: 'WebIcon',
        color: 'bg-purple-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'DevOps',
        slug: 'devops',
        description: 'Infrastructure, deployment, and automation.',
        icon: 'ServerIcon',
        color: 'bg-purple-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      
      // Subcategories for Life Skills
      {
        name: 'Tailoring',
        slug: 'tailoring',
        description: 'Clothing repair and custom tailoring.',
        icon: 'ScissorsIcon',
        color: 'bg-green-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Hair Dressing',
        slug: 'hair-dressing',
        description: 'Hair styling and care techniques.',
        icon: 'HairDryerIcon',
        color: 'bg-green-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Ironing',
        slug: 'ironing',
        description: 'Proper ironing techniques for different fabrics.',
        icon: 'IronIcon',
        color: 'bg-green-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Cooking',
        slug: 'cooking',
        description: 'Cooking recipes and techniques.',
        icon: 'PotIcon',
        color: 'bg-green-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Home Maintenance',
        slug: 'home-maintenance',
        description: 'DIY home repair and maintenance.',
        icon: 'HomeIcon',
        color: 'bg-green-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      
      // Subcategories for GeoPolitics
      {
        name: 'News',
        slug: 'geopolitics-news',
        description: 'Latest geopolitical news and analysis.',
        icon: 'ArticleIcon',
        color: 'bg-red-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Climate Changes',
        slug: 'climate-changes',
        description: 'Climate change impact and solutions.',
        icon: 'NewsIcon',
        color: 'bg-red-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Green Energy',
        slug: 'green-energy',
        description: 'Renewable energy technologies and policies.',
        icon: 'GuideIcon',
        color: 'bg-red-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      // Subcategories for Blog
      {
        name: 'Latest Articles',
        slug: 'latest-articles',
        description: 'Latest articles and updates from the blog.',
        icon: 'ArticleIcon',
        color: 'bg-amber-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Tech News',
        slug: 'tech-news',
        description: 'Latest technology news and announcements.',
        icon: 'NewsIcon',
        color: 'bg-amber-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Guides',
        slug: 'guides',
        description: 'Step-by-step guides and tutorials.',
        icon: 'GuideIcon',
        color: 'bg-amber-400',
        parentCategory: null,
        featured: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
    ];
    
    const categoryIds: Record<string, ObjectId> = {};
    
    for (const category of categories) {
      const result = await db.collection('categories').insertOne(category);
      categoryIds[category.slug] = result.insertedId;
      console.log(`✅ Category "${category.name}" created`);
    }
    
    // Update parentCategory for subcategories
    const reviewsCategoryId = categoryIds['reviews'];
    const techTutorialsCategoryId = categoryIds['tech-tutorials'];
    const lifeSkillsCategoryId = categoryIds['life-skills'];
    const geopoliticsCategoryId = categoryIds['geopolitics'];
    
    // Link Reviews subcategories
    await db.collection('categories').updateMany(
      { slug: { $in: ['phones', 'laptops', 'tablets', 'wearables'] } },
      { $set: { parentCategory: reviewsCategoryId } }
    );
    console.log('✅ Reviews subcategories linked');
    
    // Link Tech Tutorials subcategories
    await db.collection('categories').updateMany(
      { slug: { $in: ['programming', 'machine-learning', 'data-science-analytics', 'web-development', 'devops'] } },
      { $set: { parentCategory: techTutorialsCategoryId } }
    );
    console.log('✅ Tech Tutorials subcategories linked');
    
    // Link Life Skills subcategories
    await db.collection('categories').updateMany(
      { slug: { $in: ['tailoring', 'hair-dressing', 'ironing', 'cooking', 'home-maintenance'] } },
      { $set: { parentCategory: lifeSkillsCategoryId } }
    );
    console.log('✅ Life Skills subcategories linked');
    
    // Link GeoPolitics subcategories
    await db.collection('categories').updateMany(
      { slug: { $in: ['geopolitics-news', 'climate-changes', 'green-energy'] } },
      { $set: { parentCategory: geopoliticsCategoryId } }
    );
    console.log('✅ GeoPolitics subcategories linked');
    
    // Link Blog subcategories
    await db.collection('categories').updateMany(
      { slug: { $in: ['latest-articles', 'tech-news', 'guides'] } },
      { $set: { parentCategory: categoryIds['blog'] } }
    );
    console.log('✅ Blog subcategories linked');

    // Create sample articles for various categories
    const sampleArticles = [
      // Reviews category articles
      {
        slug: 'iphone-15-pro-review',
        title: 'iPhone 15 Pro Review: Is It Worth the Upgrade?',
        content: `
          <h2>Design and Build</h2>
          <p>The iPhone 15 Pro features a titanium frame that makes it both lighter and more durable than previous models.</p>
          
          <h2>Camera Performance</h2>
          <p>With its new 48MP main sensor, the iPhone 15 Pro delivers exceptional photo quality in various lighting conditions.</p>
          
          <h2>Performance</h2>
          <p>The A17 Pro chip provides blazing-fast performance for gaming, video editing, and multitasking.</p>
          
          <h2>Battery Life</h2>
          <p>All-day battery life with fast charging capabilities.</p>
          
          <h2>Verdict</h2>
          <p>If you're coming from an iPhone 13 or earlier, the iPhone 15 Pro is a significant upgrade worth considering.</p>
        `,
        excerpt: 'A comprehensive review of Apple\'s latest flagship smartphone, examining its design, camera, and performance.',
        categoryId: categoryIds['phones'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=1200&h=675&fit=crop',
        tags: ['iPhone', 'Apple', 'Smartphone', 'Review', 'Tech'],
        readTime: 12,
        status: 'published' as const,
        publishedAt: new Date('2024-02-10'),
        views: 2890,
        seo: {
          title: 'iPhone 15 Pro Review - Complete Analysis',
          description: 'Our in-depth review of the iPhone 15 Pro covering design, camera, performance, and value.',
          keywords: ['iPhone', 'Apple', 'Smartphone', 'Review', 'Tech']
        },
        createdAt: new Date('2024-02-10'),
        updatedAt: new Date('2024-02-10')
      },
      {
        slug: 'macbook-pro-m3-review',
        title: 'MacBook Pro M3 Review: The Ultimate Creative Machine',
        content: `
          <h2>Performance</h2>
          <p>The M3 chip delivers unprecedented performance for creative professionals.</p>
          
          <h2>Display Quality</h2>
          <p>The Liquid Retina XDR display is breathtaking for video editing and design work.</p>
          
          <h2>Battery Life</h2>
          <p>Up to 22 hours of battery life makes this laptop perfect for all-day use.</p>
          
          <h2>Conclusion</h2>
          <p>For creative professionals, the MacBook Pro M3 is worth every penny.</p>
        `,
        excerpt: 'An in-depth review of the latest MacBook Pro with M3 chip for creative professionals.',
        categoryId: categoryIds['laptops'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=1200&h=675&fit=crop',
        tags: ['MacBook', 'Apple', 'Laptop', 'Review', 'Creative'],
        readTime: 10,
        status: 'published' as const,
        publishedAt: new Date('2024-03-15'),
        views: 1876,
        seo: {
          title: 'MacBook Pro M3 Review - Creative Professional\'s Choice',
          description: 'Complete review of MacBook Pro M3 for video editors, designers, and developers.',
          keywords: ['MacBook', 'Apple', 'Laptop', 'Review', 'Creative']
        },
        createdAt: new Date('2024-03-15'),
        updatedAt: new Date('2024-03-15')
      },
      
      // Tech Tutorials articles
      {
        slug: 'getting-started-with-nextjs-15',
        title: 'Getting Started with Next.js 15',
        content: `
          <h2>Introduction</h2>
          <p>Next.js 15 brings exciting new features to the popular React framework. In this article, we'll explore the latest updates and how you can get started.</p>
          
          <h2>New Features</h2>
          <p>The most significant changes in Next.js 15 include improved performance, better developer experience, and new APIs for data fetching.</p>
          
          <h2>Getting Started</h2>
          <p>To create a new Next.js 15 project, run the following command:</p>
          <pre><code>npx create-next-app@latest my-app</code></pre>
          
          <h2>Conclusion</h2>
          <p>Next.js 15 continues to push the boundaries of what's possible with React frameworks. Start exploring today!</p>
        `,
        excerpt: 'Learn how to get started with the latest version of Next.js and explore its new features.',
        categoryId: categoryIds['web-development'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1200&h=675&fit=crop',
        tags: ['Next.js', 'React', 'Web Development', 'JavaScript', 'Tutorial'],
        readTime: 8,
        status: 'published' as const,
        publishedAt: new Date('2024-01-15'),
        views: 1245,
        seo: {
          title: 'Getting Started with Next.js 15 - Complete Guide',
          description: 'Learn how to get started with Next.js 15, the latest version of the popular React framework.',
          keywords: ['Next.js', 'React', 'Web Development', 'JavaScript', 'Tutorial']
        },
        createdAt: new Date('2024-01-15'),
        updatedAt: new Date('2024-01-15')
      },
      {
        slug: 'machine-learning-basics',
        title: 'Machine Learning Basics for Beginners',
        content: `
          <h2>What is Machine Learning?</h2>
          <p>Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.</p>
          
          <h2>Key Concepts</h2>
          <p>Understanding supervised vs. unsupervised learning, training vs. testing data, and common algorithms.</p>
          
          <h2>Getting Started</h2>
          <p>Begin with Python and libraries like scikit-learn to build your first machine learning model.</p>
          
          <h2>Resources</h2>
          <p>Recommended courses, books, and online resources for further learning.</p>
        `,
        excerpt: 'An introduction to machine learning concepts for absolute beginners, with practical examples and resources.',
        categoryId: categoryIds['machine-learning'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=675&fit=crop',
        tags: ['Machine Learning', 'AI', 'Data Science', 'Python', 'Beginners'],
        readTime: 15,
        status: 'published' as const,
        publishedAt: new Date('2024-03-05'),
        views: 1876,
        seo: {
          title: 'Machine Learning Basics - Beginner\'s Guide',
          description: 'Learn the fundamentals of machine learning with this comprehensive beginner-friendly guide.',
          keywords: ['Machine Learning', 'AI', 'Data Science', 'Python', 'Beginners']
        },
        createdAt: new Date('2024-03-05'),
        updatedAt: new Date('2024-03-05')
      },
      
      // Life Skills articles
      {
        slug: 'basic-tailoring-techniques',
        title: 'Basic Tailoring Techniques for Beginners',
        content: `
          <h2>Essential Tools</h2>
          <p>Learn about the must-have tools for any beginner tailor.</p>
          
          <h2>Taking Measurements</h2>
          <p>How to accurately take body measurements for clothing.</p>
          
          <h2>Basic Stitches</h2>
          <p>Master the running stitch, backstitch, and hemming stitch.</p>
          
          <h2>Simple Alterations</h2>
          <p>How to hem pants and take in shirt seams.</p>
        `,
        excerpt: 'Learn the fundamental tailoring techniques to start altering and repairing your own clothes.',
        categoryId: categoryIds['tailoring'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&h=675&fit=crop',
        tags: ['Tailoring', 'Sewing', 'DIY', 'Clothing', 'Skills'],
        readTime: 12,
        status: 'published' as const,
        publishedAt: new Date('2024-04-01'),
        views: 892,
        seo: {
          title: 'Basic Tailoring Techniques - DIY Clothing Repair',
          description: 'Learn essential tailoring techniques for clothing repair and alterations.',
          keywords: ['Tailoring', 'Sewing', 'DIY', 'Clothing', 'Skills']
        },
        createdAt: new Date('2024-04-01'),
        updatedAt: new Date('2024-04-01')
      },
      {
        slug: 'healthy-cooking-basics',
        title: 'Healthy Cooking Basics for Busy People',
        content: `
          <h2>Meal Planning</h2>
          <p>How to plan healthy meals for the week ahead.</p>
          
          <h2>Essential Kitchen Tools</h2>
          <p>The basic tools every home cook needs.</p>
          
          <h2>Quick Recipes</h2>
          <p>Healthy meals that can be prepared in under 30 minutes.</p>
          
          <h2>Meal Prep Tips</h2>
          <p>Save time by preparing ingredients in advance.</p>
        `,
        excerpt: 'Learn how to cook healthy meals even with a busy schedule.',
        categoryId: categoryIds['cooking'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1490818387583-1baba5e638af?w=1200&h=675&fit=crop',
        tags: ['Cooking', 'Healthy', 'Meal Prep', 'Recipes', 'Skills'],
        readTime: 10,
        status: 'published' as const,
        publishedAt: new Date('2024-04-05'),
        views: 1103,
        seo: {
          title: 'Healthy Cooking Basics - Quick & Easy Meals',
          description: 'Learn healthy cooking basics for preparing quick meals on a busy schedule.',
          keywords: ['Cooking', 'Healthy', 'Meal Prep', 'Recipes', 'Skills']
        },
        createdAt: new Date('2024-04-05'),
        updatedAt: new Date('2024-04-05')
      },
      
      // Blog articles
      {
        slug: 'future-of-artificial-intelligence',
        title: 'The Future of Artificial Intelligence in 2024',
        content: `
          <h2>Current Trends</h2>
          <p>Exploring the latest developments in AI research and applications.</p>
          
          <h2>Ethical Considerations</h2>
          <p>The importance of ethical AI development and deployment.</p>
          
          <h2>Industry Impact</h2>
          <p>How AI is transforming healthcare, finance, and education.</p>
          
          <h2>Looking Ahead</h2>
          <p>Predictions for AI development in the coming years.</p>
        `,
        excerpt: 'Exploring the trends and future directions of artificial intelligence technology.',
        categoryId: categoryIds['blog'],
        authorId: authorId,
        featuredImage: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200&h=675&fit=crop',
        tags: ['AI', 'Technology', 'Future', 'Innovation', 'Trends'],
        readTime: 11,
        status: 'published' as const,
        publishedAt: new Date('2024-04-10'),
        views: 2450,
        seo: {
          title: 'Future of Artificial Intelligence - 2024 Trends',
          description: 'Analysis of current trends and future directions in artificial intelligence.',
          keywords: ['AI', 'Technology', 'Future', 'Innovation', 'Trends']
        },
        createdAt: new Date('2024-04-10'),
        updatedAt: new Date('2024-04-10')
      },
      
       // GeoPolitics articles
       {
         slug: 'renewable-energy-advances',
         title: 'Recent Advances in Renewable Energy Technology',
         content: `
           <h2>Solar Power Innovations</h2>
           <p>New solar panel technologies improving efficiency and reducing costs.</p>
           
           <h2>Wind Energy Developments</h2>
           <p>Larger turbines and offshore wind farms increasing capacity.</p>
           
           <h2>Energy Storage</h2>
           <p>Breakthroughs in battery technology for grid storage.</p>
           
           <h2>Policy Impact</h2>
           <p>How government policies are accelerating the transition to clean energy.</p>
         `,
         excerpt: 'Exploring the latest technological advances in renewable energy and their global impact.',
         categoryId: categoryIds['green-energy'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?w=1200&h=675&fit=crop',
         tags: ['Renewable Energy', 'Green Technology', 'Climate', 'Sustainability'],
         readTime: 13,
         status: 'published' as const,
         publishedAt: new Date('2024-04-12'),
         views: 1567,
         seo: {
           title: 'Renewable Energy Advances - Latest Technologies',
           description: 'Overview of recent technological advances in renewable energy and their global impact.',
           keywords: ['Renewable Energy', 'Green Technology', 'Climate', 'Sustainability']
         },
         createdAt: new Date('2024-04-12'),
         updatedAt: new Date('2024-04-12')
       },
       
       // Additional 10 articles across various categories
       {
         slug: 'samsung-galaxy-s24-review',
         title: 'Samsung Galaxy S24 Review: AI-Powered Smartphone',
         content: `
           <h2>Design and Display</h2>
           <p>The Galaxy S24 features a sleek design with a vibrant Dynamic AMOLED 2X display.</p>
           
           <h2>AI Features</h2>
           <p>Galaxy AI brings new capabilities like Live Translate, Circle to Search, and Generative Edit.</p>
           
           <h2>Camera Performance</h2>
           <p>Enhanced Nightography and improved zoom capabilities make this camera system versatile.</p>
           
           <h2>Battery Life</h2>
           <p>All-day battery life with fast charging and wireless PowerShare.</p>
           
           <h2>Verdict</h2>
           <p>A compelling Android flagship with innovative AI features that set it apart from competitors.</p>
         `,
         excerpt: 'A comprehensive review of Samsung\'s latest flagship with focus on AI capabilities.',
         categoryId: categoryIds['phones'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=1200&h=675&fit=crop',
         tags: ['Samsung', 'Android', 'Smartphone', 'Review', 'AI'],
         readTime: 14,
         status: 'published' as const,
         publishedAt: new Date('2024-03-20'),
         views: 2105,
         seo: {
           title: 'Samsung Galaxy S24 Review - AI-Powered Flagship',
           description: 'In-depth review of Samsung Galaxy S24 with focus on AI features and camera performance.',
           keywords: ['Samsung', 'Galaxy S24', 'Android', 'Smartphone', 'AI']
         },
         createdAt: new Date('2024-03-20'),
         updatedAt: new Date('2024-03-20')
       },
       {
         slug: 'apple-watch-series-9-review',
         title: 'Apple Watch Series 9 Review: The Ultimate Health Companion',
         content: `
           <h2>Design and Display</h2>
           <p>Familiar design with brighter Always-On Retina display.</p>
           
           <h2>Health Features</h2>
           <p>Advanced health monitoring including ECG, blood oxygen, and sleep tracking.</p>
           
           <h2>Performance</h2>
           <p>New S9 chip delivers faster performance and enables on-device Siri processing.</p>
           
           <h2>Battery Life</h2>
           <p>18-hour battery life with new low-power mode for extended use.</p>
           
           <h2>Verdict</h2>
           <p>The best Apple Watch yet for health-conscious users.</p>
         `,
         excerpt: 'Review of Apple\'s latest smartwatch focusing on health and fitness features.',
         categoryId: categoryIds['wearables'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&h=675&fit=crop',
         tags: ['Apple', 'Watch', 'Wearable', 'Health', 'Review'],
         readTime: 11,
         status: 'published' as const,
         publishedAt: new Date('2024-02-28'),
         views: 1890,
         seo: {
           title: 'Apple Watch Series 9 Review - Health & Fitness Focus',
           description: 'Complete review of Apple Watch Series 9 health features and performance.',
           keywords: ['Apple', 'Watch', 'Wearable', 'Health', 'Fitness']
         },
         createdAt: new Date('2024-02-28'),
         updatedAt: new Date('2024-02-28')
       },
       {
         slug: 'react-19-new-features',
         title: 'React 19 New Features: What You Need to Know',
         content: `
           <h2>Server Components</h2>
           <p>React Server Components enable rendering components on the server for improved performance.</p>
           
           <h2>Actions</h2>
           <p>New Actions API simplifies form handling and data mutations.</p>
           
           <h2>Document Metadata</h2>
           <p>Built-in support for managing document metadata directly from components.</p>
           
           <h2>Asset Loading</h2>
           <p>Improved asset loading with suspense and better error handling.</p>
           
           <h2>Getting Ready</h2>
           <p>How to prepare your codebase for React 19 migration.</p>
         `,
         excerpt: 'Overview of new features and improvements in React 19.',
         categoryId: categoryIds['web-development'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=1200&h=675&fit=crop',
         tags: ['React', 'JavaScript', 'Web Development', 'Frontend', 'Tutorial'],
         readTime: 12,
         status: 'published' as const,
         publishedAt: new Date('2024-04-01'),
         views: 1780,
         seo: {
           title: 'React 19 New Features - Complete Guide',
           description: 'Learn about new features in React 19 and how to use them in your projects.',
           keywords: ['React', 'JavaScript', 'Web Development', 'Frontend', 'Tutorial']
         },
         createdAt: new Date('2024-04-01'),
         updatedAt: new Date('2024-04-01')
       },
       {
         slug: 'python-data-analysis-pandas',
         title: 'Python Data Analysis with Pandas: Complete Guide',
         content: `
           <h2>Introduction to Pandas</h2>
           <p>Pandas is the most popular data manipulation library in Python.</p>
           
           <h2>Data Structures</h2>
           <p>Understanding Series and DataFrame objects.</p>
           
           <h2>Data Cleaning</h2>
           <p>Techniques for handling missing data, duplicates, and outliers.</p>
           
           <h2>Data Analysis</h2>
           <p>Performing statistical analysis and data aggregation.</p>
           
           <h2>Visualization</h2>
           <p>Creating charts and graphs with pandas and matplotlib integration.</p>
         `,
         excerpt: 'Comprehensive guide to data analysis using Python\'s pandas library.',
         categoryId: categoryIds['data-science-analytics'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=675&fit=crop',
         tags: ['Python', 'Pandas', 'Data Science', 'Analysis', 'Tutorial'],
         readTime: 16,
         status: 'published' as const,
         publishedAt: new Date('2024-03-25'),
         views: 2200,
         seo: {
           title: 'Python Data Analysis with Pandas - Complete Tutorial',
           description: 'Learn data analysis techniques using Python\'s pandas library with practical examples.',
           keywords: ['Python', 'Pandas', 'Data Science', 'Analysis', 'Tutorial']
         },
         createdAt: new Date('2024-03-25'),
         updatedAt: new Date('2024-03-25')
       },
       {
         slug: 'docker-for-beginners',
         title: 'Docker for Beginners: Containerization Basics',
         content: `
           <h2>What is Docker?</h2>
           <p>Introduction to containerization and Docker architecture.</p>
           
           <h2>Docker Installation</h2>
           <p>How to install Docker on different operating systems.</p>
           
           <h2>Basic Commands</h2>
           <p>Essential Docker commands for managing containers and images.</p>
           
           <h2>Dockerfile</h2>
           <p>Creating custom Docker images using Dockerfile.</p>
           
           <h2>Docker Compose</h2>
           <p>Managing multi-container applications with Docker Compose.</p>
         `,
         excerpt: 'Beginner-friendly guide to Docker and containerization concepts.',
         categoryId: categoryIds['devops'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=1200&h=675&fit=crop',
         tags: ['Docker', 'DevOps', 'Containerization', 'Tutorial', 'Beginners'],
         readTime: 13,
         status: 'published' as const,
         publishedAt: new Date('2024-03-18'),
         views: 1650,
         seo: {
           title: 'Docker for Beginners - Containerization Guide',
           description: 'Learn Docker basics and containerization concepts for beginners.',
           keywords: ['Docker', 'DevOps', 'Containerization', 'Tutorial', 'Beginners']
         },
         createdAt: new Date('2024-03-18'),
         updatedAt: new Date('2024-03-18')
       },
       {
         slug: 'home-maintenance-checklist',
         title: 'Seasonal Home Maintenance Checklist',
         content: `
           <h2>Spring Maintenance</h2>
           <p>Gutter cleaning, AC unit preparation, and exterior inspection.</p>
           
           <h2>Summer Tasks</h2>
           <p>Deck maintenance, window cleaning, and pest prevention.</p>
           
           <h2>Fall Preparation</h2>
           <p>Heating system check, insulation inspection, and roof repair.</p>
           
           <h2>Winter Readiness</h2>
           <p>Pipe insulation, emergency kit preparation, and snow removal tools.</p>
           
           <h2>Year-Round Checklist</h2>
           <p>Monthly and quarterly tasks for home maintenance.</p>
         `,
         excerpt: 'Comprehensive seasonal checklist for maintaining your home throughout the year.',
         categoryId: categoryIds['home-maintenance'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1580041065738-e72023775cdc?w=1200&h=675&fit=crop',
         tags: ['Home Maintenance', 'DIY', 'Checklist', 'Home Improvement', 'Skills'],
         readTime: 14,
         status: 'published' as const,
         publishedAt: new Date('2024-03-10'),
         views: 1320,
         seo: {
           title: 'Seasonal Home Maintenance Checklist - Complete Guide',
           description: 'Comprehensive checklist for seasonal home maintenance tasks throughout the year.',
           keywords: ['Home Maintenance', 'DIY', 'Checklist', 'Home Improvement', 'Skills']
         },
         createdAt: new Date('2024-03-10'),
         updatedAt: new Date('2024-03-10')
       },
       {
         slug: 'climate-change-impact-oceans',
         title: 'Climate Change Impact on Ocean Ecosystems',
         content: `
           <h2>Ocean Warming</h2>
           <p>How rising temperatures affect marine life and coral reefs.</p>
           
           <h2>Ocean Acidification</h2>
           <p>Impact of increased CO2 absorption on shellfish and plankton.</p>
           
           <h2>Sea Level Rise</h2>
           <p>Consequences for coastal communities and island nations.</p>
           
           <h2>Marine Biodiversity</h2>
           <p>Effects on fish populations and marine food chains.</p>
           
           <h2>Conservation Efforts</h2>
           <p>Current initiatives to protect ocean ecosystems.</p>
         `,
         excerpt: 'Analysis of how climate change is affecting ocean ecosystems worldwide.',
         categoryId: categoryIds['climate-changes'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1200&h=675&fit=crop',
         tags: ['Climate Change', 'Ocean', 'Environment', 'Ecosystem', 'Conservation'],
         readTime: 15,
         status: 'published' as const,
         publishedAt: new Date('2024-04-08'),
         views: 1980,
         seo: {
           title: 'Climate Change Impact on Oceans - Environmental Analysis',
           description: 'Detailed analysis of how climate change affects ocean ecosystems and marine life.',
           keywords: ['Climate Change', 'Ocean', 'Environment', 'Ecosystem', 'Conservation']
         },
         createdAt: new Date('2024-04-08'),
         updatedAt: new Date('2024-04-08')
       },
       {
         slug: 'advanced-tailoring-pattern-making',
         title: 'Advanced Tailoring: Pattern Making Techniques',
         content: `
           <h2>Understanding Patterns</h2>
           <p>Basic pattern blocks and their variations.</p>
           
           <h2>Measurement Taking</h2>
           <p>Advanced techniques for accurate body measurements.</p>
           
           <h2>Pattern Drafting</h2>
           <p>Creating custom patterns from measurements.</p>
           
           <h2>Pattern Manipulation</h2>
           <p>Techniques for modifying existing patterns.</p>
           
           <h2>Fitting Adjustments</h2>
           <p>Common fitting issues and how to fix them in patterns.</p>
         `,
         excerpt: 'Advanced techniques for creating and modifying sewing patterns.',
         categoryId: categoryIds['tailoring'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1507691641503-c1c39b2ba0e9?w=1200&h=675&fit=crop',
         tags: ['Tailoring', 'Pattern Making', 'Sewing', 'Advanced', 'Skills'],
         readTime: 18,
         status: 'published' as const,
         publishedAt: new Date('2024-04-15'),
         views: 950,
         seo: {
           title: 'Advanced Tailoring Pattern Making - Complete Guide',
           description: 'Learn advanced pattern making techniques for custom clothing creation.',
           keywords: ['Tailoring', 'Pattern Making', 'Sewing', 'Advanced', 'Skills']
         },
         createdAt: new Date('2024-04-15'),
         updatedAt: new Date('2024-04-15')
       },
       {
         slug: 'tech-layoffs-2024-analysis',
         title: 'Tech Industry Layoffs 2024: Analysis and Trends',
         content: `
           <h2>Current Landscape</h2>
           <p>Overview of major tech layoffs in 2024 across different companies.</p>
           
           <h2>Causes and Factors</h2>
           <p>Economic pressures, over-hiring during pandemic, and AI disruption.</p>
           
           <h2>Industry Impact</h2>
           <p>Effects on innovation, startup funding, and job market.</p>
           
           <h2>Regional Differences</h2>
           <p>How different tech hubs are affected by the layoffs.</p>
           
           <h2>Future Outlook</h2>
           <p>Predictions for the tech job market and recovery timeline.</p>
         `,
         excerpt: 'Analysis of the 2024 tech industry layoffs and their implications.',
         categoryId: categoryIds['tech-news'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=675&fit=crop',
         tags: ['Tech News', 'Layoffs', 'Industry', 'Analysis', '2024'],
         readTime: 12,
         status: 'published' as const,
         publishedAt: new Date('2024-04-18'),
         views: 3200,
         seo: {
           title: 'Tech Industry Layoffs 2024 - Complete Analysis',
           description: 'Detailed analysis of 2024 tech industry layoffs, causes, and future trends.',
           keywords: ['Tech News', 'Layoffs', 'Industry', 'Analysis', '2024']
         },
         createdAt: new Date('2024-04-18'),
         updatedAt: new Date('2024-04-18')
       },
       {
         slug: 'web-accessibility-best-practices',
         title: 'Web Accessibility Best Practices for Developers',
         content: `
           <h2>Understanding Accessibility</h2>
           <p>What is web accessibility and why it matters.</p>
           
           <h2>WCAG Guidelines</h2>
           <p>Overview of Web Content Accessibility Guidelines (WCAG) 2.1.</p>
           
           <h2>Semantic HTML</h2>
           <p>Using proper HTML elements for better accessibility.</p>
           
           <h2>ARIA Attributes</h2>
           <p>When and how to use ARIA attributes effectively.</p>
           
           <h2>Testing Tools</h2>
           <p>Best tools for testing and improving website accessibility.</p>
         `,
         excerpt: 'Essential web accessibility practices for creating inclusive websites.',
         categoryId: categoryIds['guides'],
         authorId: authorId,
         featuredImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=675&fit=crop',
         tags: ['Accessibility', 'Web Development', 'Best Practices', 'Guide', 'Inclusive'],
         readTime: 14,
         status: 'published' as const,
         publishedAt: new Date('2024-04-05'),
         views: 1450,
         seo: {
           title: 'Web Accessibility Best Practices - Developer Guide',
           description: 'Comprehensive guide to web accessibility best practices for developers.',
           keywords: ['Accessibility', 'Web Development', 'Best Practices', 'Guide', 'Inclusive']
         },
         createdAt: new Date('2024-04-05'),
         updatedAt: new Date('2024-04-05')
       },
     ];
    
    let articlesCreated = 0;
    for (const article of sampleArticles) {
      await db.collection('articles').insertOne(article);
      articlesCreated++;
      console.log(`✅ Article "${article.title}" created`);
    }
    
    // Create tags from article tags
    const uniqueTagNames = [...new Set(sampleArticles.flatMap(a => a.tags))];
    const tagSeeds = uniqueTagNames.map(name => {
      const relatedTags = sampleArticles
        .filter(a => a.tags.includes(name))
        .flatMap(a => a.tags)
        .filter(t => t !== name);
      const uniqueRelated = [...new Set(relatedTags)].slice(0, 5);
      return {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description: `Articles and tutorials about ${name}`,
        relatedTags: uniqueRelated,
        articleCount: sampleArticles.filter(a => a.tags.includes(name)).length,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    for (const tag of tagSeeds) {
      await db.collection('tags').insertOne(tag);
      console.log(`✅ Tag "${tag.name}" created`);
    }

    console.log(`\n🎉 Seed completed successfully!`);
    console.log(`📊 Created/updated:`);
    console.log(`   - ${seedUsers.length} users (superuser, admin, editor, author, user)`);
    console.log(`   - ${Object.keys(categoryIds).length} categories`);
    console.log(`   - ${tagSeeds.length} tags`);
    console.log(`   - ${articlesCreated} articles`);
    console.log(`\n🔑 Default credentials (all use password123):`);
    console.log(`   Superuser: superuser@techhub.example.com`);
    console.log(`   Admin: admin@techhub.example.com`);
    console.log(`   Editor: editor@techhub.example.com`);
    console.log(`   Author: author@techhub.example.com`);
    console.log(`   User: user@techhub.example.com`);
    console.log(`\n🌐 Website structure:`);
    console.log(`   - Homepage: /`);
    console.log(`   - Categories: /category/{slug}`);
    console.log(`   - Articles: /article/{slug}`);
    console.log(`   - Blog: /blog`);
    console.log(`   - Admin: /admin (requires admin/editor role)`);
    console.log(`   - Sign in: /auth/signin`);
    console.log(`\n🚀 Start the development server with: npm run dev`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Parse CLI flags
const args = process.argv.slice(2);
const force = args.includes('--force') || args.includes('-f');
const checkOnly = args.includes('--check');

if (checkOnly) {
  (async () => {
    const { db } = await connectToDatabase();
    const empty = await isDatabaseEmpty(db);
    if (empty) {
      console.log('📭 Database is empty — seed data will be inserted on next full run.');
    } else {
      const articleCount = await db.collection('articles').countDocuments();
      const categoryCount = await db.collection('categories').countDocuments();
      const userCount = await db.collection('users').countDocuments();
      console.log(`📊 Database has existing data:`);
      console.log(`   - ${articleCount} articles`);
      console.log(`   - ${categoryCount} categories`);
      console.log(`   - ${userCount} users`);
    }
    process.exit(0);
  })();
}

// Run the seed function
seedDatabase(force);