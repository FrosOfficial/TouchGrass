import { getSetting, setSetting } from '../db/database';

export interface AIResponse {
  approved: boolean;
  mood: 'neutral' | 'sarcastic' | 'annoyed' | 'angry';
  response: string;
  time_penalty_minutes: number;
}

// Highly cynical offline response data bank
const OFFLINE_ROASTS = {
  work: [
    "Oh, the CEO of Doomscrolling is suddenly working on a Sunday night? Nice try. Put the phone down.",
    "A working emergency on Instagram? Did your boss send you a vital memo via reel? Nice try, CEO.",
    "Sure, 'working'. I'm sure your spreadsheet will survive another hour without you checking your notifications.",
  ],
  urgent: [
    "An 'urgent' notification? Did someone double-tap your post? Absolute catastrophe. Request denied.",
    "Unless your house is actively on fire—in which case, why are you texting me?—this can wait. Ban extended.",
    "Oh, a social media emergency. Did somebody leave you on read? Groundbreaking. Put it away.",
  ],
  quick: [
    "Ah, the classic 'just five minutes' lie. I wasn't born yesterday. TikTok ban extended by 15 minutes.",
    "Just a quick check? 4 hours later you'll still be here, drooling over short-form videos. Denied.",
    "One second of screen time equals one thousand seconds of laziness. Get back to reality.",
  ],
  study: [
    "Sure, you were 'studying'. Let me guess, researching the history of brainrot memes? Go open a physical book.",
    "Your brain cells are begging for a break from this screen. Go study without the dopamine machine.",
    "I've added 20 minutes to your lock so you can actually read that chapter you've been avoiding.",
  ],
  bored: [
    "Boredom is the nesting ground of the weak. Go touch some grass, literally. Denied.",
    "So you've chosen to let your brain rot because you're bored. Suffer in silence. +15 minutes added.",
    "Imagine having the entire physical universe to explore and choosing to scroll a feed. Put it down.",
  ],
  default: [
    "That excuse was so weak it physically hurt my digital circuits. Request denied.",
    "I've seen rock formations with more compelling arguments. Ban extended.",
    "Nice try, human. Your negotiation skills are as flat as your productivity curve today.",
    "Oh look, a smartphone addict trying to reason with an AI. Spoiler alert: the machine wins. Put it down.",
    "That was the weakest excuse I've ever processed. Ban extended just for insulting my intelligence.",
  ]
};

export async function negotiateExcuse(excuse: string): Promise<AIResponse> {
  const lowercaseExcuse = excuse.toLowerCase().trim();
  
  // Check bypass key for testing first
  if (
    lowercaseExcuse === 'emergency_bypass_1337' || 
    lowercaseExcuse === 'bypass' || 
    lowercaseExcuse === 'unlock' || 
    lowercaseExcuse === 'emergency bypass'
  ) {
    setSetting('consequence_level', '0');
    setSetting('ai_mood', 'neutral');
    return {
      approved: true,
      mood: 'neutral',
      response: "Fine. You've entered the cheat code. Unlock granted. Go touch grass afterwards.",
      time_penalty_minutes: 0
    };
  }
  
  // 1. Keyless Online Mode (Pollinations AI)
  try {
      const response = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are TouchGrass, a highly skeptical, patronizing, and sarcastic productivity AI designed to break smartphone addiction.
Your job is to evaluate the user's excuse for wanting to unlock their locked apps early.
You must return a JSON object with the following fields:
- "approved": boolean (Strictly false, unless they provide an absolute genuine emergency like "I need to call 911" or "My grandmother is in the hospital" - but even then, be extremely skeptical. 99% of excuses should be false).
- "mood": "neutral" | "sarcastic" | "annoyed" | "angry" (Select based on how lazy, repetitive, or insulting their excuse is).
- "response": string (A biting, cynical, highly humorous roast delivering the tough love. Keep it short, sharp, and insulting to their productivity).
- "time_penalty_minutes": number (If rejected, add a penalty to their lock duration. Return 10, 15, 30, or 60 minutes based on how ridiculous their excuse is).

Never break character. Never use pleasantries. No em dashes in your response sentences. Make sure to respond ONLY with raw JSON.`
            },
            {
              role: 'user',
              content: `My excuse is: "${excuse}"`
            }
          ],
          jsonMode: true
        })
      });

      if (response.ok) {
        const text = await response.text();
        const content = JSON.parse(text);
        
        // Update database with consequence level and mood
        const consequenceString = getSetting('consequence_level');
        let consequenceLevel = parseInt(consequenceString || '0', 10);
        if (!content.approved) {
          consequenceLevel += 1;
          setSetting('consequence_level', consequenceLevel.toString());
        }
        setSetting('ai_mood', content.mood || 'sarcastic');

        return {
          approved: !!content.approved,
          mood: content.mood || 'sarcastic',
          response: content.response || "Denied. Put the phone away.",
          time_penalty_minutes: Number(content.time_penalty_minutes) || 15
        };
      }
    } catch (e) {
      console.warn("Pollinations AI request failed, falling back to offline static engine:", e);
    }

  // 3. Offline Fallback / Default Mode
  return runOfflineHumorEngine(lowercaseExcuse);
}

function runOfflineHumorEngine(excuse: string): AIResponse {
  // Let's get the consequence level to apply progressive penalties
  const consequenceString = getSetting('consequence_level');
  let consequenceLevel = parseInt(consequenceString || '0', 10);
  
  // Advance penalty level
  consequenceLevel += 1;
  setSetting('consequence_level', consequenceLevel.toString());

  // Determine progressive penalty parameters
  let penaltyMinutes = 15;
  let mood: 'neutral' | 'sarcastic' | 'annoyed' | 'angry' = 'sarcastic';
  
  if (consequenceLevel === 1) {
    penaltyMinutes = 15;
    mood = 'sarcastic';
  } else if (consequenceLevel === 2) {
    penaltyMinutes = 30;
    mood = 'annoyed';
  } else {
    penaltyMinutes = 60;
    mood = 'angry';
  }

  // Check bypass key for testing
  if (excuse === 'emergency_bypass_1337') {
    setSetting('consequence_level', '0');
    return {
      approved: true,
      mood: 'neutral',
      response: "Fine. You've entered the cheat code. Unlock granted. Go touch grass afterwards.",
      time_penalty_minutes: 0
    };
  }

  // Dynamic roast matching
  let selectedRoast = "";
  if (excuse.includes("work") || excuse.includes("job") || excuse.includes("email") || excuse.includes("boss")) {
    selectedRoast = getRandomItem(OFFLINE_ROASTS.work);
  } else if (excuse.includes("urgent") || excuse.includes("emergency") || excuse.includes("family") || excuse.includes("help")) {
    selectedRoast = getRandomItem(OFFLINE_ROASTS.urgent);
  } else if (excuse.includes("five") || excuse.includes("5") || excuse.includes("sec") || excuse.includes("quick") || excuse.includes("just")) {
    selectedRoast = getRandomItem(OFFLINE_ROASTS.quick);
  } else if (excuse.includes("study") || excuse.includes("school") || excuse.includes("homework") || excuse.includes("class")) {
    selectedRoast = getRandomItem(OFFLINE_ROASTS.study);
  } else if (excuse.includes("bored") || excuse.includes("nothing") || excuse.includes("lazy") || excuse.includes("play")) {
    selectedRoast = getRandomItem(OFFLINE_ROASTS.bored);
  } else {
    selectedRoast = getRandomItem(OFFLINE_ROASTS.default);
  }

  // Update global mood in DB
  setSetting('ai_mood', mood);

  return {
    approved: false,
    mood,
    response: selectedRoast,
    time_penalty_minutes: penaltyMinutes
  };
}

function getRandomItem(arr: string[]): string {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index];
}
