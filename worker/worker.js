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

    const title = (data.title || "").toString().trim().slice(0, 200);
    const rating = (data.rating || "").toString().trim().slice(0, 10);
    const comment = (data.comment || "").toString().trim().slice(0, 2000);

    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const issueTitle = "[Оцінка] " + title;
    const issueBody = "Оцінка (1-10): " + rating + "\n\nКоментар: " + comment;

    const ghRes = await fetch(
      "https://api.github.com/repos/" + REPO + "/issues",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.GITHUB_TOKEN,
          "Accept": "application/vnd.github+json",
          "User-Agent": "tredchan-films-worker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: issueTitle, body: issueBody }),
      }
    );

    if (!ghRes.ok) {
      const errText = await ghRes.text();
      return new Response(JSON.stringify({ error: "GitHub API error", details: errText }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const ghData = await ghRes.json();
    return new Response(JSON.stringify({ success: true, url: ghData.html_url }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  },
};
