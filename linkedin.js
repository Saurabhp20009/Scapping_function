
async function reloginUsingCookies(context, page) {
    const cookiesLoaded = await loadCookies(context);

    if (cookiesLoaded) {
        await page.goto('https://www.linkedin.com/', { waitUntil: 'networkidle' });
        const isLoggedIn = !(await page.locator('#username').isVisible());
        if (isLoggedIn) {
            console.log("Logged in using cookies.");
            return true;
        } else {
            console.log("Cookies are invalid. Logging in again...");
        }
    } else {
        console.log("No cookies found. Logging in...");
    }

    await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle' });
    await page.type('#username', 'saurabhpatwal92000@gmail.com', { delay: 100 });
    await page.type('#password', '8755121823aS@', { delay: 100 });
    await page.waitForTimeout(3000)
    await page.click('[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle' });

    await saveCookies(context);
    return true;
}

async function searchLinkedIn() {
    const browser = await chromium.launch({
        headless: false,
        slowMo: 30,
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    const connection = await getDatabaseConnection()

    await reloginUsingCookies(context, page);

    const searchInputSelector = 'input.search-global-typeahead__input';

    await page.waitForSelector(searchInputSelector, { visible: true });
    await page.type(searchInputSelector, 'latest in ai', { delay: 100 });
    await page.keyboard.press('Enter');

    console.log("Waiting for search results to load...");
    await page.waitForSelector('main', { visible: true, timeout: 60000 });

     // Wait for the search filters bar
     await page.waitForSelector('nav[aria-label="Search filters"]', { timeout: 10000 });
     console.log('Search filters bar found');
 
     // Find and click the "Posts" filter
     const postsFilterSelector = '//button[contains(., "Posts")]';
 
     const isPostsFilterVisible = await page.isVisible(postsFilterSelector);
     if (isPostsFilterVisible) {
       await page.click(postsFilterSelector);
       console.log('Clicked on "Posts" filter');
     } else {
       console.error('Posts filter is not visible or not loaded');
       return;
     }
 

    console.log('Applied "Posts" filter and results are loaded.');

    for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        console.log(`Scrolling iteration ${i + 1}`);
        await page.waitForTimeout(2000); // Wait for additional posts to load
    }

    await page.waitForTimeout(10000);

    const profiles = await page.evaluate(() => {
        const profileList = [];
        const mainElement = document.querySelector('main');
      
    



        // if (!mainElement) {
        //     console.error("Main element not found!");
        //     return false;
        // }

       


        const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
        const phoneRegex = /\b(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/;


        const posts = document.querySelectorAll('.artdeco-card.mb2');



        posts.forEach((post) => {

            const profileLinkElement = post.querySelector(
                'a.update-components-actor__meta-link'
            );

            if (profileLinkElement) {
                profileList.push(
                    profileLinkElement.href,
                );
            }
        });

        return profileList;




    });

    console.log("profiles", profiles);

    const profileDetails = [];


    // Visit each profile and scrape details
    for (const profileLink of profiles) {
        await page.goto(profileLink);
        await page.waitForTimeout(6000)
        await page.waitForSelector('section.artdeco-card');

        const profileData = await page.evaluate(() => {
            const nameElement = document.querySelector('h1');
            const titleElement = document.querySelector('.text-body-medium.break-words');
            const locationElement = document.querySelector('.wIGJVoSjLPCkBjYPypkkFloaPmPDygCuVY.mt2 span.text-body-small');
            const contactInfoLink = document.querySelector('#top-card-text-details-contact-info');

            const name = nameElement ? nameElement.innerText.trim() : 'N/A';
            const title = titleElement ? titleElement.innerText.trim() : 'N/A';
            const location = locationElement ? locationElement.innerText.trim() : 'N/A';
            const contactInfoUrl = contactInfoLink ? contactInfoLink.href : null;

            return { name, title, location, contactInfoUrl };
        });

        // If there's a contact info link, extract email and phone
        if (profileData.contactInfoUrl) {
            await page.goto(profileData.contactInfoUrl);
            const contactDetails = await page.evaluate(() => {
                const emailElement = document.querySelector('a[href^="mailto:"]');
                const phoneElement = document.querySelector('span[data-test-phone-number]');

                const email = emailElement ? emailElement.innerText.trim() : 'N/A';
                const phone = phoneElement ? phoneElement.innerText.trim() : 'N/A';

                return { email, phone };
            });

            profileData.email = contactDetails.email;
            profileData.phone = contactDetails.phone;
        }

        const query = `
        INSERT INTO profiles(Name,Title,Email,PhoneNumber)
        VALUES (?, ?,?,?)
        ON DUPLICATE KEY UPDATE Email = VALUES(Email);`;


        await connection.execute(query, [profileData.name,profileData.title ? profileData.title: null ,profileData.email ? profileData.email: null,profileData.phone? profileData.phone: null]);


        profileDetails.push(profileData);
        console.log('Scraped Profile:', profileData);
    }

    console.log('Final Profile Details:', profileDetails);

    fs.writeFile('linkdin_leads.json', JSON.stringify(profileDetails, null, 4), 'utf8', err => {
        if (err) {
            console.error('Failed to save profile data to file:', err);
        } else {
            console.log('All profile data saved to profileInfo.json');
        }
    });

    await page.waitForTimeout(6000)



}

searchLinkedIn().catch(console.error);
