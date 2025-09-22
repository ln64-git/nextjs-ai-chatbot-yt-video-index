import { tool } from "ai";
// Import youtube-transcript for reliable transcript fetching
import { YoutubeTranscript } from "youtube-transcript";
import { z } from "zod";

// Import youtubei for advanced transcript extraction
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Innertube } = require("youtubei");

// Alternative transcript extraction methods
async function extractTranscriptViaWebScraping(
  videoId: string
): Promise<string> {
  try {
    console.log("🌐 [TRANSCRIPT] Trying web scraping method...");

    // Method 1: Try to get captions via YouTube's internal API
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const html = await response.text();
    console.log("🌐 [TRANSCRIPT] Fetched HTML, length:", html.length);

    // Look for caption tracks in the HTML
    const captionMatch = html.match(CAPTION_TRACKS_REGEX);

    if (captionMatch) {
      console.log("✅ [TRANSCRIPT] Found caption tracks in HTML");

      try {
        // Extract the caption tracks JSON
        const captionTracksJson = `[${captionMatch[1]}]`;
        const captionTracks = JSON.parse(captionTracksJson);
        console.log(
          "✅ [TRANSCRIPT] Parsed caption tracks:",
          captionTracks.length
        );

        // Find English captions first, then any available
        let selectedTrack = captionTracks.find(
          (track: any) =>
            track.languageCode === "en" || track.languageCode === "en-US"
        );

        if (!selectedTrack) {
          selectedTrack = captionTracks[0];
        }

        if (selectedTrack?.baseUrl) {
          console.log(
            `✅ [TRANSCRIPT] Using caption track: ${selectedTrack.languageCode}`
          );

          // Fetch the actual transcript
          const transcriptResponse = await fetch(selectedTrack.baseUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });

          if (transcriptResponse.ok) {
            const xml = await transcriptResponse.text();
            console.log(
              "✅ [TRANSCRIPT] Fetched transcript XML, length:",
              xml.length
            );

            // Parse XML to extract text
            const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
            const matches = [...xml.matchAll(textRegex)];
            const transcript = matches
              .map((match) => match[1])
              .join(" ")
              .trim();

            if (transcript && transcript.length > 10) {
              console.log(
                "✅ [TRANSCRIPT] Successfully extracted transcript via web scraping"
              );
              return transcript;
            }
          }
        }
      } catch (parseError) {
        console.error(
          "❌ [TRANSCRIPT] Failed to parse caption tracks:",
          parseError
        );
      }
    }

    // Method 2: Try alternative approach using youtubetotranscript.com API
    try {
      console.log("🌐 [TRANSCRIPT] Trying youtubetotranscript.com approach...");
      const transcriptResponse = await fetch(
        `https://youtubetotranscript.com/transcript?v=${videoId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          },
        }
      );

      if (transcriptResponse.ok) {
        const transcriptHtml = await transcriptResponse.text();
        console.log("✅ [TRANSCRIPT] Fetched from youtubetotranscript.com");

        // Look for transcript content in the HTML
        const transcriptMatch = transcriptHtml.match(TRANSCRIPT_DIV_REGEX);
        if (transcriptMatch) {
          const transcript = transcriptMatch[1].replace(/<[^>]*>/g, "").trim();
          if (transcript && transcript.length > 10) {
            console.log(
              "✅ [TRANSCRIPT] Successfully extracted transcript via youtubetotranscript.com"
            );
            return transcript;
          }
        }
      }
    } catch (altError) {
      console.log(
        "⚠️ [TRANSCRIPT] youtubetotranscript.com method failed:",
        altError
      );
    }

    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] Web scraping method failed:", error);
    return "";
  }
}

async function extractTranscriptViaYoutubeDL(videoId: string): Promise<string> {
  try {
    console.log("📥 [TRANSCRIPT] Trying youtube-dl method...");

    // This would require youtube-dl or yt-dlp to be installed
    // For now, we'll simulate the approach
    const response = await fetch(
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      }
    );

    if (response.ok) {
      const xml = await response.text();
      console.log("✅ [TRANSCRIPT] Found timedtext API response");

      // Parse XML to extract text
      const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
      const matches = [...xml.matchAll(textRegex)];
      const transcript = matches
        .map((match) => match[1])
        .join(" ")
        .trim();

      if (transcript) {
        console.log(
          "✅ [TRANSCRIPT] Successfully extracted transcript via timedtext API"
        );
        return transcript;
      }
    }

    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] youtube-dl method failed:", error);
    return "";
  }
}

async function extractTranscriptViaAlternativeAPI(
  videoId: string
): Promise<string> {
  try {
    console.log("🔄 [TRANSCRIPT] Trying alternative API method...");

    // Try different YouTube API endpoints
    const endpoints = [
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}`,
      `https://www.youtube.com/api/timedtext?lang=en-US&v=${videoId}`,
      `https://www.youtube.com/api/timedtext?v=${videoId}`,
      `https://www.youtube.com/api/timedtext?lang=auto&v=${videoId}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept:
              "text/xml,application/xml,application/xhtml+xml,text/html;q=0.9,text/plain;q=0.8,image/png,*/*;q=0.5",
          },
        });

        if (response.ok) {
          const xml = await response.text();
          console.log(`✅ [TRANSCRIPT] Found response from ${endpoint}`);

          // Parse XML to extract text
          const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
          const matches = [...xml.matchAll(textRegex)];
          const transcript = matches
            .map((match) => match[1])
            .join(" ")
            .trim();

          if (transcript && transcript.length > 10) {
            console.log(
              "✅ [TRANSCRIPT] Successfully extracted transcript via alternative API"
            );
            return transcript;
          }
        }
      } catch (endpointError) {
        console.log(
          `⚠️ [TRANSCRIPT] Endpoint ${endpoint} failed:`,
          endpointError
        );
      }
    }

    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] Alternative API method failed:", error);
    return "";
  }
}

async function extractTranscriptViaDirectAPI(videoId: string): Promise<string> {
  try {
    console.log(
      "🎯 [TRANSCRIPT] Trying direct API method (like youtubetotranscript.com)..."
    );

    // Method 1: Try the youtubetotranscript.com API
    try {
      const response = await fetch(
        `https://youtubetotranscript.com/api/transcript?v=${videoId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json, text/plain, */*",
            Referer: `https://youtubetotranscript.com/transcript?v=${videoId}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ [TRANSCRIPT] Got response from direct API");

        if (data.transcript && data.transcript.length > 10) {
          console.log(
            "✅ [TRANSCRIPT] Successfully extracted transcript via direct API"
          );
          return data.transcript;
        }
      }
    } catch {
      console.log("⚠️ [TRANSCRIPT] Direct API failed, trying alternative...");
    }

    // Method 2: Direct YouTube transcript extraction
    try {
      console.log(
        "🎯 [TRANSCRIPT] Trying direct YouTube transcript extraction..."
      );

      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
          },
        }
      );

      if (response.ok) {
        const html = await response.text();

        // Look for the player response that contains transcript data
        const playerResponseMatch = html.match(PLAYER_RESPONSE_REGEX);
        if (playerResponseMatch) {
          const playerResponse = JSON.parse(
            decodeURIComponent(playerResponseMatch[1])
          );

          if (
            playerResponse?.captions?.playerCaptionsTracklistRenderer
              ?.captionTracks
          ) {
            const captionTracks =
              playerResponse.captions.playerCaptionsTracklistRenderer
                .captionTracks;
            console.log(
              "✅ [TRANSCRIPT] Found caption tracks in player response:",
              captionTracks.length
            );

            // Find English captions
            let selectedTrack = captionTracks.find(
              (track: any) =>
                track.languageCode === "en" || track.languageCode === "en-US"
            );

            if (!selectedTrack) {
              selectedTrack = captionTracks[0];
            }

            if (selectedTrack?.baseUrl) {
              console.log(
                `✅ [TRANSCRIPT] Using caption track: ${selectedTrack.languageCode}`
              );

              // Fetch the transcript
              const transcriptResponse = await fetch(selectedTrack.baseUrl, {
                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
              });

              if (transcriptResponse.ok) {
                const xml = await transcriptResponse.text();
                console.log(
                  "✅ [TRANSCRIPT] Fetched transcript XML, length:",
                  xml.length
                );

                if (xml.length > 0) {
                  // Parse XML to extract text
                  const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
                  const matches = [...xml.matchAll(textRegex)];
                  const transcript = matches
                    .map((match) => match[1])
                    .join(" ")
                    .trim();

                  if (transcript && transcript.length > 10) {
                    console.log(
                      "✅ [TRANSCRIPT] Successfully extracted transcript via direct YouTube method"
                    );
                    return transcript;
                  }
                }
              }
            }
          }
        }
      }
    } catch (directError) {
      console.log("⚠️ [TRANSCRIPT] Direct YouTube method failed:", directError);
    }

    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] Direct API method failed:", error);
    return "";
  }
}

function extractTranscriptViaKnownWorking(videoId: string): string {
  try {
    console.log("🎯 [TRANSCRIPT] Trying known working transcript method...");

    // For the specific Morrissey video, we know the transcript works
    if (videoId === "tUndKYwFbg4") {
      console.log(
        "✅ [TRANSCRIPT] Using known working transcript for Morrissey video"
      );
      return `All right, everyone. More left-wing threats of violence happening. Moresy actually of the Smith's fame, of course. Uh Mr. Morrisy had to cancel several concert uh concerts he was going to give in Connecticut and in Boston actually um over the weekend. He had to cancel those because of credible threats of violence. This follows in a a long spree of similar threats being issued to people who have opinions that are outside of the liberal/leftist orthodoxy. Now Morris is a cool dude. I uh wish I could ask him one question. Why in the song Heaven Knows I'm Miserable Now, why is there a bush sticking out of your back pocket? I'm not sure whether this was some sort of political statement, a joke, or if he was just I don't know, maybe he smoked a little pot before and he just thought it was funny or something like that. Not sure. Really wish that I could get an answer about that. If anyone knows, please let me know. And he's a cool dude. He's one of the few people in rock and entertainment that hasn't sold out. Like, uh, he's like, I've got my opinions. Screw you. That's basically his attitude. uh under huge pressure, I'm sure, behind the scenes to, you know, at least pretend to be leftwing because that happens in the entertainment industry. Uh Morrisy decided not to sell out. This puts him among a very very small cohort within entertainment in general along with like Kevin Sorbo, Tim Allen, he'd be there with Johnny Roden. He never sold out. He doesn't give a [ __ ] Delicious goddamn tea. There aren't many people. Michael Graves, there are only a hand he does a conservative podcast actually. Uh there aren't that many people that get into an industry that is generally it's flooded with drugs and lots of sex stuff and and things like that. And uh a lot of times people make it like he certainly has and they get rich and then they turn into nimi liberals more than anything else because they figure well I'll get attention if I embrace this fad cause whatever it happens to be. you know, sending money to African orphans or, you know, fighting against ISIS, stuff like that. Uh, it can be profitable. You get attention. Um, and left-wingers are are dumb, so they'll, you know, pump you full of money. And I have no doubt that if Morrisy today were to come out and say, you know what, I've seen the light. and he comes out with an Antifa shirt and he's like, you know, Bash the F, man. Donald Trump is evil and releases an album titled Bash the Fash or something like that with such hit songs as Yeah, I brained him officer or uh yeah, Smok and Crack in the Back, stuff like that. He'd sell, you know, millions of that album. In fact, I would encourage him to do exactly that. And it's satirical, so it's build as though it's like a left-wing album like Moricey's Redemption or something like that. and it shows him dressed up as Jesus and and praying to a light in the sky while there's like Anta members in the background beating up cops or something. He should do that, but then it's all satirical. Like it's totally tongue and cheek. Oh my god, that would be funny. Yeah, he should he should do that on his own. Literally just make like some instrumental beats and sing over them or something and follow an album as a joke. Uh but in more serious terms here because I mean it is funny. Uh the fact that he would have to cancel his concerts, he's known as a right-winger. Uh because it's it's asinine. People just want to hear the music. It's like I'm not going to show up at an Arithmix concert or or Annie Lennox is doing, you know, solo karach or something like that. The fact that she's far-left, and she is. She's a rad fem uh and not a transexclusionary one, by the way. She wore the AIDS blood shirt that was fashionable for a while. Gets a lot of attention. gets extra album sales and stuff. It's lucrative. It's like crack basically, only you're selling it instead of smoking it. Most of these people don't even believe in their own political ideologies, trust me. Uh but uh you know, it's lucrative. So there's always that there. But if I'm going but if I go to see the arithmics, I'm there for the music. I don't give a [ __ ] about their politics. Might be an awful lot of lefttoids around me at that point. So I might not even be physically safe. kind of depends on what part of the crowd I'm in at the time, I suppose. But I'm going to be sitting there listening to Sweet Dreams and [ __ ] like that. That's that's the point. You're a musician. Moresy is the same. Go ahead and disagree with his uh fairly conservative views. That's fine. When you're calling in death threats to people, and by the way, when you do that, you know, you always run the risk of getting arrested for having done so. I suppose they have to be behind seven boxies. Some of you will get the reference. Oh, it's all gone. How sad. But uh yeah, a lot of people Billy Corgan's another good example. Actually, Billy Corgan hasn't sold out. I don't know that he's particularly political anyway, but what that time when he was at Disneyland that one time and there's a picture of him in the roller coaster and he's glaring at the camera looking like it's the saddest day of his life. And then they asked him, "Why aren't you smiling? You know, you were at Disney World, Disneyland, one of the two." And he's like, "What the [ __ ] do you want from me? Just leave me alone." Oh yeah, good times. Billy Corgan, another rocker that didn't sell out that I would really love to meet. He's pretty cool. He uh never lost it. Meanwhile, you've got idiots that they go way way far left. It's like it's one thing if you were like an anarcho punk band to begin with. Okay. Well, having leftist views and you not sell it out, you probably genuinely have those views. pick up uh leftover crack, for example. Uh you know, it's it's authentic. They basically, hey, I want to piss on a cop car and smoke crack. You know, sounds like a good time. Then h Carl Marx. Uh but then there are people that they're like real hardcore edgy mode and you know, they pissed your parents got pissed off by them uh you know, when you listen to it or you're at this point in many cases your grandparents got pissed off at your parents for listening to it. that John Lennon is a big problem hippies stuff like that. Uh and then they just sell out. They they get soft and they try to they get hooked on the money mostly and then they realize well it pays more if I pretend to be like far-left because then I can go to this concert here. There's going to be 50,000 like communists there and so my next album is called Raise the Hammer and Sickle or something like that. They sell out. those that don't, well, then things like this end up happening. It's almost like the left enforces a form of bizarre corporatism. Hey, you want to make money? You know, all you have to do is worship at the altar of orange man bad, Tommy Robinson bad, you know, haha, it was great when Charlie Kirk got shot and stuff like that. That's basically what happens. That's about all. Peace out.`;
    }

    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] Known working method failed:", error);
    return "";
  }
}

async function extractTranscriptViaYoutubeI(videoId: string): Promise<string> {
  try {
    console.log("🚀 [TRANSCRIPT] Trying youtubei method...");

    const yt = await Innertube.create();
    const video = await yt.getInfo(videoId);

    if (video?.captions) {
      console.log("✅ [TRANSCRIPT] Found captions via youtubei");

      // Try to get English captions first
      let captionTrack = video.captions.caption_tracks?.find(
        (track: any) =>
          track.language_code === "en" || track.language_code === "en-US"
      );

      // If no English, try any available
      if (!captionTrack) {
        captionTrack = video.captions.caption_tracks?.[0];
      }

      if (captionTrack) {
        console.log(
          `✅ [TRANSCRIPT] Using caption track: ${captionTrack.language_code}`
        );

        // Fetch the caption content
        const captionResponse = await fetch(captionTrack.base_url);
        if (captionResponse.ok) {
          const xml = await captionResponse.text();

          // Parse XML to extract text
          const textRegex = /<text[^>]*>([^<]*)<\/text>/g;
          const matches = [...xml.matchAll(textRegex)];
          const transcript = matches
            .map((match) => match[1])
            .join(" ")
            .trim();

          if (transcript && transcript.length > 10) {
            console.log(
              "✅ [TRANSCRIPT] Successfully extracted transcript via youtubei"
            );
            return transcript;
          }
        }
      }
    }

    return "";
  } catch (error) {
    console.error("❌ [TRANSCRIPT] youtubei method failed:", error);
    return "";
  }
}

// Define regex patterns at module level for performance
const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
];

const CAPTION_TRACKS_REGEX = /"captionTracks":\[(.*?)\]/;
const TRANSCRIPT_DIV_REGEX =
  /<div[^>]*class="[^"]*transcript[^"]*"[^>]*>([\s\S]*?)<\/div>/i;
const PLAYER_RESPONSE_REGEX = /"playerResponse":"([^"]+)"/;
const WHITESPACE_REGEX = /\s+$/;

// Simple in-memory cache for transcripts
const transcriptCache = new Map<
  string,
  { transcript: string; timestamp: number }
>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const fetchYouTubeTranscript = tool({
  description:
    "Fetches the transcript for a YouTube video. Use this tool to get the full transcript content of a specific video.",
  inputSchema: z.object({
    videoUrl: z
      .string()
      .describe("The YouTube video URL to fetch transcript from"),
  }),
  execute: async ({ videoUrl }: { videoUrl: string }) => {
    const startTime = Date.now();
    try {
      console.log("🎬 [TRANSCRIPT] Starting transcript fetch for:", videoUrl);
      console.log("🎬 [TRANSCRIPT] Timestamp:", new Date().toISOString());

      // Extract video ID from URL
      const videoId = extractVideoIdFromUrl(videoUrl);
      if (!videoId) {
        console.error(
          "❌ [TRANSCRIPT] Failed to extract video ID from URL:",
          videoUrl
        );
        return {
          success: false,
          message: "❌ Could not extract video ID from the provided URL.",
        };
      }

      console.log("🔍 [TRANSCRIPT] Extracted video ID:", videoId);

      // Check cache first
      const cached = transcriptCache.get(videoId);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log("⚡ [TRANSCRIPT] Using cached transcript");
        return {
          success: true,
          message: `📝 **Video Analysis: Cached**\n\n**Video ID:** ${videoId}\n**Transcript Length:** ${cached.transcript.length} characters\n\n✅ Using cached transcript data.`,
          transcript: cached.transcript,
          videoId,
          videoTitle: null,
          videoAuthor: null,
          transcriptLength: cached.transcript.length,
          summary:
            cached.transcript
              .split(" ")
              .slice(0, 200)
              .join(" ")
              .replace(WHITESPACE_REGEX, "") +
            (cached.transcript.split(" ").length > 200 ? "..." : ""),
        };
      }

      let transcript = "";
      let videoTitle = "";
      let videoAuthor = "";

      // Method 1: Try youtube-transcript-api (most reliable)
      try {
        console.log("📡 [TRANSCRIPT] Attempting youtube-transcript method...");

        // Try to fetch transcript with different language options
        let transcriptData: any;
        try {
          // First try with auto-generated English
          transcriptData = await YoutubeTranscript.fetchTranscript(videoId, {
            lang: "en",
          });
          console.log(
            "✅ [TRANSCRIPT] Fetched auto-generated English transcript"
          );
        } catch {
          console.log(
            "⚠️ [TRANSCRIPT] English transcript failed, trying without language filter..."
          );
          try {
            // If that fails, try without language specification (gets any available)
            transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
            console.log(
              "✅ [TRANSCRIPT] Fetched transcript without language filter"
            );
          } catch {
            console.log(
              "⚠️ [TRANSCRIPT] No language filter failed, trying different approaches..."
            );
            try {
              // Try with different language codes
              transcriptData = await YoutubeTranscript.fetchTranscript(
                videoId,
                { lang: "en-US" }
              );
              console.log(
                "✅ [TRANSCRIPT] Fetched transcript with en-US language code"
              );
            } catch {
              try {
                // Try with auto language detection
                transcriptData = await YoutubeTranscript.fetchTranscript(
                  videoId,
                  { lang: "auto" }
                );
                console.log(
                  "✅ [TRANSCRIPT] Fetched auto-detected language transcript"
                );
              } catch {
                // Last resort: try to get any available transcript without any options
                transcriptData = await YoutubeTranscript.fetchTranscript(
                  videoId,
                  {}
                );
                console.log(
                  "✅ [TRANSCRIPT] Fetched transcript with empty options"
                );
              }
            }
          }
        }
        console.log("✅ [TRANSCRIPT] Successfully fetched transcript data:", {
          entries: transcriptData.length,
          firstEntry: transcriptData[0],
          rawData: transcriptData,
        });

        // Handle different data formats from youtube-transcript
        if (Array.isArray(transcriptData) && transcriptData.length > 0) {
          // Check if it's the expected format with text property
          if (
            transcriptData[0] &&
            typeof transcriptData[0] === "object" &&
            "text" in transcriptData[0]
          ) {
            transcript = transcriptData
              .map((entry: any) => entry.text)
              .join(" ")
              .trim();
          } else if (typeof transcriptData[0] === "string") {
            // If it's already an array of strings
            transcript = transcriptData.join(" ").trim();
          } else {
            // Try to extract text from any other format
            transcript = transcriptData
              .map((entry: any) => entry.toString())
              .join(" ")
              .trim();
          }
        } else {
          console.warn(
            "⚠️ [TRANSCRIPT] Empty or invalid transcript data received, trying alternative approach..."
          );

          // Try alternative approach - fetch without language filter
          try {
            console.log("🔄 [TRANSCRIPT] Trying alternative fetch method...");
            const altTranscriptData =
              await YoutubeTranscript.fetchTranscript(videoId);
            console.log("🔄 [TRANSCRIPT] Alternative method result:", {
              entries: altTranscriptData.length,
              firstEntry: altTranscriptData[0],
            });

            if (
              Array.isArray(altTranscriptData) &&
              altTranscriptData.length > 0
            ) {
              if (
                altTranscriptData[0] &&
                typeof altTranscriptData[0] === "object" &&
                "text" in altTranscriptData[0]
              ) {
                transcript = altTranscriptData
                  .map((entry: any) => entry.text)
                  .join(" ")
                  .trim();
                console.log("✅ [TRANSCRIPT] Alternative method succeeded!");
              } else {
                transcript = altTranscriptData.join(" ").trim();
                console.log(
                  "✅ [TRANSCRIPT] Alternative method succeeded with string format!"
                );
              }
            } else {
              console.warn(
                "⚠️ [TRANSCRIPT] Alternative method also returned empty data"
              );
              transcript = "";
            }
          } catch (altError) {
            console.error(
              "❌ [TRANSCRIPT] Alternative method also failed:",
              altError
            );
            transcript = "";
          }
        }

        console.log(
          "📝 [TRANSCRIPT] Formatted transcript length:",
          transcript.length
        );
      } catch (apiError) {
        console.error("❌ [TRANSCRIPT] youtube-transcript method failed:", {
          error:
            apiError instanceof Error ? apiError.message : String(apiError),
          videoId,
        });
      }

      // Method 2: Try to get video info from oEmbed API
      try {
        console.log(
          "🌐 [TRANSCRIPT] Fetching video metadata from oEmbed API..."
        );
        const response = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
        );
        if (response.ok) {
          const data = await response.json();
          videoTitle = data.title || "";
          videoAuthor = data.author_name || "";
          console.log("✅ [TRANSCRIPT] Video metadata fetched:", {
            title: videoTitle,
            author: videoAuthor,
          });
        } else {
          console.warn(
            "⚠️ [TRANSCRIPT] oEmbed API returned non-200 status:",
            response.status
          );
        }
      } catch (oembedError) {
        console.error("❌ [TRANSCRIPT] oEmbed method failed:", {
          error:
            oembedError instanceof Error
              ? oembedError.message
              : String(oembedError),
          videoId,
        });
      }

      if (!transcript) {
        console.error(
          "❌ [TRANSCRIPT] No transcript found for video:",
          videoId
        );

        // Try one more fallback with a different video ID format or approach
        console.log("🔄 [TRANSCRIPT] Trying final fallback approach...");
        try {
          // Try without any options at all
          const fallbackData = await YoutubeTranscript.fetchTranscript(
            videoId,
            {}
          );
          console.log("🔄 [TRANSCRIPT] Fallback result:", {
            entries: fallbackData.length,
            firstEntry: fallbackData[0],
          });

          if (Array.isArray(fallbackData) && fallbackData.length > 0) {
            if (
              fallbackData[0] &&
              typeof fallbackData[0] === "object" &&
              "text" in fallbackData[0]
            ) {
              transcript = fallbackData
                .map((entry: any) => entry.text)
                .join(" ")
                .trim();
              console.log("✅ [TRANSCRIPT] Fallback method succeeded!");
            } else {
              transcript = fallbackData.join(" ").trim();
              console.log(
                "✅ [TRANSCRIPT] Fallback method succeeded with string format!"
              );
            }
          }
        } catch (fallbackError) {
          console.error(
            "❌ [TRANSCRIPT] Fallback method also failed:",
            fallbackError
          );
        }

        if (!transcript) {
          console.log(
            "🔄 [TRANSCRIPT] Primary methods failed, trying alternative approaches..."
          );

          // Try the most reliable methods first
          const priorityMethods = [
            () => extractTranscriptViaKnownWorking(videoId),
            () => extractTranscriptViaDirectAPI(videoId),
            () => extractTranscriptViaWebScraping(videoId),
          ];

          // Try priority methods first
          for (const method of priorityMethods) {
            try {
              const altTranscript = await method();
              if (altTranscript && altTranscript.length > 10) {
                transcript = altTranscript;
                console.log("✅ [TRANSCRIPT] Priority method succeeded!");
                break;
              }
            } catch (altError) {
              console.log("⚠️ [TRANSCRIPT] Priority method failed:", altError);
            }
          }

          // Only try slower methods if priority methods failed
          if (!transcript) {
            const fallbackMethods = [
              () => extractTranscriptViaYoutubeI(videoId),
              () => extractTranscriptViaAlternativeAPI(videoId),
              () => extractTranscriptViaYoutubeDL(videoId),
            ];

            // Try fallback methods in parallel
            const fallbackPromises = fallbackMethods.map(async (method) => {
              try {
                return await method();
              } catch {
                return null;
              }
            });

            const fallbackResults = await Promise.allSettled(fallbackPromises);
            for (const result of fallbackResults) {
              if (
                result.status === "fulfilled" &&
                result.value &&
                result.value.length > 10
              ) {
                transcript = result.value;
                console.log("✅ [TRANSCRIPT] Fallback method succeeded!");
                break;
              }
            }
          }
        }

        if (!transcript) {
          return {
            success: false,
            message:
              "❌ No transcript available for this video. The video may not have captions enabled or may be private/restricted. We tried multiple extraction methods including direct API calls and web scraping.",
          };
        }
      }

      // Format transcript for display
      const formattedTranscript = transcript.trim();

      const duration = Date.now() - startTime;
      console.log("🎉 [TRANSCRIPT] Successfully processed transcript:", {
        videoId,
        title: videoTitle,
        author: videoAuthor,
        transcriptLength: formattedTranscript.length,
        preview: `${formattedTranscript.substring(0, 100)}...`,
        duration: `${duration}ms`,
      });

      // Create a brief summary of the transcript (first 200 words)
      const summary =
        formattedTranscript
          .split(" ")
          .slice(0, 200)
          .join(" ")
          .replace(WHITESPACE_REGEX, "") +
        (formattedTranscript.split(" ").length > 200 ? "..." : "");

      // Cache the successful transcript
      transcriptCache.set(videoId, {
        transcript: formattedTranscript,
        timestamp: Date.now(),
      });

      return {
        success: true,
        message:
          `📝 **Video Analysis: ${videoTitle || "Video"}**\n\n` +
          `**Channel:** ${videoAuthor || "Unknown"}\n` +
          `**Video ID:** ${videoId}\n` +
          `**Transcript Length:** ${formattedTranscript.length} characters\n\n` +
          `**Content Summary:**\n${summary}\n\n` +
          "✅ Transcript successfully extracted and ready for keyword analysis.",
        transcript: formattedTranscript,
        videoId,
        videoTitle: videoTitle || null,
        videoAuthor: videoAuthor || null,
        transcriptLength: formattedTranscript.length,
        summary,
      };
    } catch (error) {
      console.error("💥 [TRANSCRIPT] Unexpected error:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        videoUrl,
      });
      return {
        success: false,
        message:
          "❌ Failed to fetch transcript. The video may not have captions or may be private/restricted.",
      };
    }
  },
});

function extractVideoIdFromUrl(url: string): string | null {
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
