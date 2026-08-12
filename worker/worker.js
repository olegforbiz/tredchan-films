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
      const rating = (data.rating || "").toString().trim().slice(0, 10);
      const comment = (data.comment || "").toString().trim().slice(0, 2000);

      if (!title) return jsonResponse({ error: "Title is required" }, 400);

      const issueTitle = "[Оцінка] " + title;
      const issueBody = "Ім'я: " + name + "\n\nОцінка (1-10): " + rating + "\n\nКоментар: " + comment;

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

    return jsonResponse({ error: "Unknown type" }, 400);
  },
};
