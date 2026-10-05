---
layout: post
title: "Your First Website on GitHub Pages: A Beginner's Guide"
date: 2026-10-05 09:00:00 -0400
description: "Put a real website on the internet for free in about 15 minutes. No servers, no command line, no credit card. Just a browser and a GitHub account."
tags: [github, beginner, web]
level: Beginner
---

This site runs on GitHub Pages. It costs nothing to host, and I didn't need to set up a server, rent a domain or touch a command line to get it online. If you've ever wanted your own corner of the internet for a portfolio, a project page or just a place to tinker, this is the easiest way I know to get there.

By the end of this guide you'll have a live website at an address like `yourname.github.io` that anyone in the world can visit.

> **WHAT YOU NEED**
>
> - A web browser
> - An email address (for a free GitHub account)
> - About 15 minutes
>
> No coding experience is required. You'll copy and paste one small file.

## What is GitHub Pages?

**GitHub** is a website where people store code and track every change they make to it. Each project lives in a **repository**, or "repo" for short. A repo is basically a folder that remembers its own history.

**GitHub Pages** is a free feature that takes the files in a repo and serves them as a website. You put an `index.html` file in the repo, and GitHub turns it into a web page and hosts it for you.

The tradeoff is that Pages only serves **static** sites: HTML, CSS, JavaScript, images. There's no database or login system running behind it. For a personal site, a portfolio or a blog, that's all you need.

## Step 1: Create a GitHub account

1. Go to [github.com](https://github.com) and click **Sign up**.
2. Pick your username carefully. **It becomes part of your website address.** If your username is `pixelpirate`, your site will be `pixelpirate.github.io`.
3. Verify your email address when GitHub asks you to.

> **TIP:** Usernames are case-insensitive in web addresses, so `PixelPirate` and `pixelpirate` lead to the same site. Short and easy to spell beats clever.

## Step 2: Create your repository

The name of this repo is important. It has to follow a specific pattern for GitHub to treat it as your main website.

1. Once you're signed in, click the **+** in the top-right corner and choose **New repository**.
2. In **Repository name**, type your username followed by `.github.io`. For example: `pixelpirate.github.io`
3. Set the repo to **Public**. Free accounts can only publish Pages sites from public repos.
4. Tick **Add a README file**. It gives the repo a starting file so it isn't empty.
5. Click **Create repository**.

> **IMPORTANT:** The repo name must match your username *exactly*, followed by `.github.io`. If they don't match, your site ends up at a longer address like `pixelpirate.github.io/my-site` instead.

## Step 3: Add your first page

Every website needs a homepage, and on GitHub Pages that file is called `index.html`. When someone visits your site, GitHub sends them this file first.

1. In your new repo, click **Add file**, then **Create new file**.
2. Name the file `index.html`. It has to be all lowercase.
3. Paste this into the big editing box:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My First Website</title>
  <style>
    body {
      background: #0a0a1a;
      color: #e8e8ff;
      font-family: monospace;
      max-width: 640px;
      margin: 4rem auto;
      padding: 0 1rem;
      line-height: 1.6;
    }
    h1 { color: #ffe600; }
    a  { color: #00ffff; }
  </style>
</head>
<body>
  <h1>Hello, world!</h1>
  <p>This is my first website, hosted for free on GitHub Pages.</p>
  <p>More coming soon.</p>
</body>
</html>
```

4. Click **Commit changes…**, then **Commit changes** again in the box that pops up.

A **commit** is a saved snapshot of your files. Every time you commit, GitHub records exactly what changed, and that history will save you one day. More on that below.

## Step 4: Turn on GitHub Pages

For a repo named `yourname.github.io`, Pages is often switched on automatically. It's still worth checking:

1. In your repo, click **Settings** (the tab with the gear icon).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.

## Step 5: Visit your live site

1. Click the **Actions** tab in your repo. You'll see a job called **pages build and deployment**.
2. A yellow dot means it's still building. A green ✓ means your site is live. It usually takes one to two minutes.
3. Open a new tab and go to `https://yourname.github.io`.

You should see "Hello, world!" on a dark background. That's your page, live on the internet. **Level complete.**

## Step 6: Make a change

You'll update your site the same way every time:

1. Open `index.html` in your repo.
2. Click the **pencil icon** to edit it.
3. Change something, like the text inside the `<h1>` tags.
4. Click **Commit changes**.
5. Wait about a minute, then refresh your site.

Edit, commit, wait, refresh. That loop is all there is to it.

## Troubleshooting: when things go wrong

Something will break eventually. Here's what I've actually run into and how to fix it.

### "404 — There isn't a GitHub Pages site here"

- Check that your repo name is *exactly* `yourname.github.io`.
- Check that the file is named `index.html`, not `Index.html` or `index.htm`, and that it sits in the top level of the repo rather than inside a folder.
- Check **Settings → Pages** and make sure a branch is selected.
- If you just created the site, give it a few minutes.

### "I changed something but the site looks the same"

Your browser is probably showing you an old copy it saved earlier, called the **cache**. Open the site in a private/incognito window, or press **Ctrl + F5** (**Cmd + Shift + R** on Mac) to force a fresh load.

### A red ✗ in the Actions tab

That means the build failed and **your site is still showing the previous version**. Click the failed run to see why. Sometimes it's a mistake in your files, but sometimes GitHub itself has a hiccup.

> **REAL STORY:** My own site sat broken for weeks because of this. I'd fixed a file, but the deploy failed with "Service Unavailable", which was GitHub's servers having a bad moment and nothing to do with my code. The site kept serving the broken version, and I didn't notice. The fix was clicking **Re-run all jobs**. **Always check the Actions tab after a commit.**

### My site redirects somewhere weird

Look for a file called `CNAME` in your repo. It tells GitHub to use a custom domain. If you didn't set up a custom domain on purpose, delete that file and the redirect goes away.

### I broke my page and need it back

This is where commits pay off. Open the file in your repo and click **History**. You'll see every version you've ever saved. Open an older one, copy its contents and paste them back in with a new commit. Nothing on GitHub is ever really lost.

## Where to go next

- **Add more pages.** Create `about.html` next to `index.html` and link to it with `<a href="about.html">About</a>`.
- **Add images.** Use **Add file → Upload files** to upload a picture, then show it with `<img src="photo.jpg" alt="Describe the photo">`.
- **Learn more HTML and CSS.** [MDN's Getting Started with the Web](https://developer.mozilla.org/en-US/docs/Learn) is free and excellent.
- **Get a custom domain.** Once you're comfortable, you can point a domain you own, like `yourname.com`, at your Pages site under **Settings → Pages → Custom domain**.

You now have a website that's free, version-controlled and yours. Go build something weird with it.
