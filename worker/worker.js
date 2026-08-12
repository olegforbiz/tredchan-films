export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = "https://olegforbiz.github.io";
    const REPO = "olegforbiz/tredchan-films";

    function corsHeaders() {
      return {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      };
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const ghHeaders = {
      "Authorization": "Bearer " + env.GITHUB_TOKEN,
      "Accept": "application/vnd.github+json",
      "User-Agent": "tredchan-films-worker",
      "Content-Type": "application/json",
    };

    function jsonResponse(obj, status) {
      return new Response(JSON.stringify(obj), {
        status: status,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const type = (data.type || "rate").toString();

    if (type === "rate") {
      const title = (data.title || "").toString().trim().slice(0, 200);
      const name = ((data.name || "").toString().trim() || "Тредчан").slice(0, 60);
      const ratingRaw = (data.rating || "").toString().trim().slice(0, 10);
      const comment = (data.comment || "").toString().trim().slice(0, 2000);

      if (!title) return jsonResponse({ error: "Title is required" }, 400);

      const ratingNum = parseFloat(ratingRaw);
      if (!ratingRaw || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 10) {
        return jsonResponse({ error: "Rating must be between 1 and 10" }, 400);
      }

      const issueTitle = "[Оцінка] " + title;
      const issueBody = "Ім'я: " + name + "\n\nОцінка (1-10): " + ratingNum + "\n\nКоментар: " + comment;

      const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues", {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ title: issueTitle, body: issueBody }),
      });
      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const ghData = await ghRes.json();
      return jsonResponse({ success: true, url: ghData.html_url, issueNumber: ghData.number }, 200);
    }

    if (type === "propose") {
      const title = (data.title || "").toString().trim().slice(0, 200);
      const name = ((data.name || "").toString().trim() || "Тредчан").slice(0, 60);
      const comment = (data.comment || "").toString().trim().slice(0, 2000);
      const year = (data.year || "").toString().trim().slice(0, 10);
      const originalTitle = (data.originalTitle || "").toString().trim().slice(0, 200);
      const description = (data.description || "").toString().trim().slice(0, 1000);
      const poster = (data.poster || "").toString().trim().slice(0, 500);
      const director = (data.director || "").toString().trim().slice(0, 100);
      const mediaType = (data.mediaType || "").toString().trim().slice(0, 20);

      if (!title) return jsonResponse({ error: "Title is required" }, 400);

      const issueTitle = "[Фільм] " + title;
      let issueBody = "Ім'я: " + name + "\n";
      if (originalTitle && originalTitle !== title) issueBody += "Оригінальна назва: " + originalTitle + "\n";
      if (year) issueBody += "Рік: " + year + "\n";
      if (director) issueBody += "Режисер: " + director + "\n";
      if (mediaType) issueBody += "Тип: " + mediaType + "\n";
      if (poster) issueBody += "Постер: " + poster + "\n";
      issueBody += "\n";
      if (description) issueBody += "Опис: " + description + "\n\n";
      issueBody += "Коментар тредчана: " + comment;

      const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues", {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ title: issueTitle, body: issueBody }),
      });
      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const ghData = await ghRes.json();
      return jsonResponse({ success: true, url: ghData.html_url, issueNumber: ghData.number }, 200);
    }

    if (type === "like") {
      const title = (data.title || "").toString().trim().slice(0, 200);
      if (!title) return jsonResponse({ error: "Title is required" }, 400);

      const issueTitle = "[Лайк] " + title;
      const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues", {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ title: issueTitle, body: "👍" }),
      });
      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const ghData = await ghRes.json();
      return jsonResponse({ success: true, issueNumber: ghData.number }, 200);
    }

    if (type === "unlike") {
      const issueNumber = parseInt(data.issueNumber, 10);
      if (!issueNumber || issueNumber < 1) return jsonResponse({ error: "Valid issueNumber is required" }, 400);

      const getRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + issueNumber, {
        headers: ghHeaders,
      });
      if (!getRes.ok) {
        const errText = await getRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const issueData = await getRes.json();
      if (!issueData.title || issueData.title.indexOf("[Лайк]") !== 0) {
        return jsonResponse({ error: "Issue is not a like record" }, 403);
      }

      const patchRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + issueNumber, {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({ state: "closed" }),
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      return jsonResponse({ success: true }, 200);
    }

    if (type === "seen") {
      const title = (data.title || "").toString().trim().slice(0, 200);
      const name = ((data.name || "").toString().trim() || "Тредчан").slice(0, 60);
      if (!title) return jsonResponse({ error: "Title is required" }, 400);

      const issueTitle = "[Переглянуто] " + title;
      const issueBody = "Ім'я: " + name;
      const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues", {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ title: issueTitle, body: issueBody }),
      });
      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const ghData = await ghRes.json();
      return jsonResponse({ success: true, issueNumber: ghData.number }, 200);
    }

    if (type === "unseen") {
      const issueNumber = parseInt(data.issueNumber, 10);
      if (!issueNumber || issueNumber < 1) return jsonResponse({ error: "Valid issueNumber is required" }, 400);

      const getRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + issueNumber, {
        headers: ghHeaders,
      });
      if (!getRes.ok) {
        const errText = await getRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const issueData = await getRes.json();
      if (!issueData.title || issueData.title.indexOf("[Переглянуто]") !== 0) {
        return jsonResponse({ error: "Issue is not a seen record" }, 403);
      }

      const patchRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + issueNumber, {
        method: "PATCH",
        headers: ghHeaders,
        body: JSON.stringify({ state: "closed" }),
      });
      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      return jsonResponse({ success: true }, 200);
    }

    if (type === "reply") {
      const issueNumber = parseInt(data.issueNumber, 10);
      const name = ((data.name || "").toString().trim() || "Тредчан").slice(0, 60);
      const text = (data.text || "").toString().trim().slice(0, 2000);

      if (!issueNumber || issueNumber < 1) return jsonResponse({ error: "Valid issueNumber is required" }, 400);
      if (!text) return jsonResponse({ error: "Text is required" }, 400);

      const commentBody = "Ім'я: " + name + "\n\n" + text;
      const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + issueNumber + "/comments", {
        method: "POST",
        headers: ghHeaders,
        body: JSON.stringify({ body: commentBody }),
      });
      if (!ghRes.ok) {
        const errText = await ghRes.text();
        return jsonResponse({ error: "GitHub API error", details: errText }, 502);
      }
      const ghData = await ghRes.json();
      return jsonResponse({ success: true, id: ghData.id }, 200);
    }


    if (type === "approve" || type === "closeIssue" || type === "deleteComment") {
      if (!env.ADMIN_KEY || data.adminKey !== env.ADMIN_KEY) {
        return jsonResponse({ error: "Unauthorized" }, 403);
      }

      if (type === "approve") {
        const number = parseInt(data.number, 10);
        const approveTitle = (data.title || "").toString().trim().slice(0, 200);
        if (!number || !approveTitle) return jsonResponse({ error: "Number and title are required" }, 400);

        let proposerName = "Тредчан";
        let proposerComment = "";
        const origRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + number, {
          headers: ghHeaders,
        });
        if (origRes.ok) {
          const origData = await origRes.json();
          const origBody = origData.body || "";
          const nameMatch = origBody.match(/Ім\'я:\s*([^\n]*)/i);
          if (nameMatch && nameMatch[1].trim()) proposerName = nameMatch[1].trim();
          const commentMatch = origBody.match(/Коментар тредчана:\s*([\s\S]*)/i);
          if (commentMatch) proposerComment = commentMatch[1].trim();
        }

        const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + number, {
          method: "PATCH",
          headers: ghHeaders,
          body: JSON.stringify({ title: "[Схвалено] " + approveTitle }),
        });
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return jsonResponse({ error: "GitHub API error", details: errText }, 502);
        }

        if (proposerComment) {
          const commentIssueBody = "Ім\'я: " + proposerName + "\n\nКоментар: " + proposerComment;
          await fetch("https://api.github.com/repos/" + REPO + "/issues", {
            method: "POST",
            headers: ghHeaders,
            body: JSON.stringify({ title: "[Оцінка] " + approveTitle, body: commentIssueBody }),
          });
        }

        return jsonResponse({ success: true }, 200);
      }

      if (type === "closeIssue") {
        const number = parseInt(data.number, 10);
        if (!number) return jsonResponse({ error: "Number is required" }, 400);
        const allowedPrefixes = ["[Оцінка]", "[Лайк]", "[Фільм]", "[Переглянуто]", "[Схвалено]"];
        const getRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + number, {
          headers: ghHeaders,
        });
        if (!getRes.ok) {
          const errText = await getRes.text();
          return jsonResponse({ error: "GitHub API error", details: errText }, 502);
        }
        const issueData = await getRes.json();
        const titleOk = allowedPrefixes.some(function (p) { return (issueData.title || "").indexOf(p) === 0; });
        if (!titleOk) return jsonResponse({ error: "Issue type not allowed" }, 400);
        const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/" + number, {
          method: "PATCH",
          headers: ghHeaders,
          body: JSON.stringify({ state: "closed" }),
        });
        if (!ghRes.ok) {
          const errText = await ghRes.text();
          return jsonResponse({ error: "GitHub API error", details: errText }, 502);
        }
        return jsonResponse({ success: true }, 200);
      }

      if (type === "deleteComment") {
        const commentId = parseInt(data.commentId, 10);
        if (!commentId) return jsonResponse({ error: "commentId is required" }, 400);
        const ghRes = await fetch("https://api.github.com/repos/" + REPO + "/issues/comments/" + commentId, {
          method: "DELETE",
          headers: ghHeaders,
        });
        if (!ghRes.ok && ghRes.status !== 404) {
          const errText = await ghRes.text();
          return jsonResponse({ error: "GitHub API error", details: errText }, 502);
        }
        return jsonResponse({ success: true }, 200);
      }
    }

    return jsonResponse({ error: "Unknown type" }, 400);
  },
};
