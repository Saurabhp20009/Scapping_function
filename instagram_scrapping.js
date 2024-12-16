// Scraping function
async function navigateInstagramWithCookies(keyword, record,format) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    const connection = await getDatabaseConnection();  // Get database connection

    try {
        const cookies = await fs.promises.readFile('instagram_cookies.json', 'utf8').then(JSON.parse).catch(() => []);
        await context.addCookies(cookies);

        await page.goto('https://www.instagram.com');

        console.log('Navigating and searching for:', keyword);

        // Wait for the search input and perform search
        await page.waitForSelector('svg[aria-label="Search"]');
        await page.click('svg[aria-label="Search"]');
        await page.waitForSelector('input[aria-label="Search input"]', { state: 'visible' });
        await page.fill('input[aria-label="Search input"]', keyword, { delay: 10 });
        await page.press('input[aria-label="Search input"]', 'Enter');
        await page.waitForTimeout(6000);

        // Click on the first element with the long class chain
        await page.click('a.x1i10hfl.x1qjc9v5.xjbqb8w.xjqpnuy.xa49m3k.xqeqjp1.x2hbi6w.x13fuv20.xu3j5b3.x1q0q8m5.x26u7qi.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1ypdohk.xdl72j9.x2lah0s.xe8uvvx.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x2lwn1j.xeuugli.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x16tdsg8.x1hl2dhg.xggy1nq.x1ja2u2z.x1t137rt.x1q0g3np.x87ps6o.x1lku1pv.x1a2a7pz.x1dm5mii.x16mil14.xiojian.x1yutycm.x1lliihq.x193iq5w.xh8yej3', { timeout: 5000 });

        // Wait for the posts to appear on the page
        await page.waitForSelector('.x1qjc9v5.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1lliihq.xdt5ytf.x2lah0s.xrbpyxo.x1a7h2tk.x14miiyz.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x11njtxf.x1bfs520.xph46j.x9i3mqj.xcghwft.x1bzgcud.xhdunbi',{timeout:5000});

        // Scroll down multiple times to load more posts
        for (let i = 0; i < 3; i++) { // Scroll down 3 times
            await page.evaluate(() => window.scrollBy(0, window.innerHeight));
            await page.waitForTimeout(3000); // Wait for new content to load
        }

        // Extract information from all matching posts
        const postsInfo = await page.$$eval(
            '.x1qjc9v5.x972fbf.xcfux6l.x1qhh985.xm0m39n.x9f619.x1lliihq.xdt5ytf.x2lah0s.xrbpyxo.x1a7h2tk.x14miiyz.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x1n2onr6.x11njtxf.x1bfs520.xph46j.x9i3mqj.xcghwft.x1bzgcud.xhdunbi',
            (elements, limit) =>
                elements.slice(0, limit).map(el => {
                    const link = el.querySelector('a');
                    return {
                        postLink: link?.href
                    };
                }),
            record
        );

        console.log("profile",postsInfo)

        console.log(`Found ${postsInfo.length} posts:`);
        const profileFullData = [];

        for (const { postLink } of postsInfo) {
            try {
                // Navigate to the post link
                await page.goto(postLink);
                await page.waitForTimeout(5000);

                // Extract profile link
                const profileLink = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'));
                    return links
                        .map(link => link.href)
                        .find(href => /^https:\/\/www\.instagram\.com\/[^\/]+\/$/.test(href));
                });
         
              
                

                if (profileLink) {
                    await page.goto(profileLink);
                    await page.waitForTimeout(5000);

                    // Extract profile data
                    // const profileInfo = await page.$eval('header', header => {
                    //     const image = header.querySelector('img')?.src;
                    //     const name = header.querySelector('h2')?.textContent;
                    //     const description = header.querySelector('section')?.textContent.trim();
                    //     const stats = Array.from(header.querySelectorAll('li span')).map(el => el.textContent);
                    //     const [posts, followers, following] = stats;
                        
                    //     const website = header.querySelector('a[href^="http"]')?.href;
                    //     const additionalLinks = Array.from(header.querySelectorAll('a[role="link"][tabindex="0"]'))
                    //         .map(a => ({ text: a.textContent, url: a.href }));

                    //     // Extract email and phone number from description if available
                    //     const emailMatch = description.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
                    //     const phoneMatch = description.match(/\+?\d[\d\-\s]{7,14}\d/);

                       

                    //     // Store data in MySQL

 
                       
                    //     return { name, description, posts, emailMatch, phoneMatch, website, additionalLinks };
                    // });


                    const profileInfo = await page.$eval(
                        'div.x7a106z', // The main container class
                        container => {
                            // Title
                            const titleElement = container.querySelector('span[dir="auto"]');
                            const title = titleElement ? titleElement.textContent.trim() : null;
                    
                            // Description
                            const descriptionElement = container.querySelector('span._ap3a._aaco._aacu._aacx._aad7._aade');
                            const description = descriptionElement ? descriptionElement.textContent.trim() : null;
                    
                            // Links in the description
                            const links = Array.from(descriptionElement.querySelectorAll('a')).map(link => ({
                                text: link.textContent.trim(),
                                url: link.href
                            }));

                            
                    
                            return { title, description, links };
                        }
                    );
                    
                   
                  
                    
                console.log(profileInfo)    

                    const query = `
                    INSERT INTO InstagramData (Name, Description)
                    VALUES (?, ?)
                    ON DUPLICATE KEY UPDATE Description = VALUES(Description);
                `;
                
                await connection.execute(query, [profileInfo.title , profileInfo.description ? profileInfo.description : null]);
                
                
                }
               
                //console.log(profileFullData)

                // Generate file after scraping
                //const filePath = await generateFile(profileFullData, keyword, format);

            

              
            } catch (error) {
                console.error(`Error processing ${postLink}: ${error}`);
            }
        }

        return profileFullData;
    } catch (error) {
        console.error('Error during scraping:', error);
        await browser.close();
        throw error;
    }
}
