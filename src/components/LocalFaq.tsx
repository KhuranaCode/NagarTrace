// Local multilingual FAQ - code-only port of the reviewed mobile component
// (mananbharti/NagarTrace-mobile feat/local-faq bfc841e). No network, no storage,
// no provider, no account data: fixed content + transient in-memory search only.
import { useState } from 'react'

type Lang = 'en' | 'hi' | 'pa'
type Entry = { id: string; keys: string; q: Record<Lang, string>; a: Record<Lang, string> }
const FAQ: Entry[] = [
  { id: 'about', keys: 'about what nagartrace kya ki hai project',
    q: { en: 'What is NagarTrace?', hi: 'NagarTrace kya hai?', pa: 'NagarTrace ki hai?' },
    a: { en: 'NagarTrace is a civic road-hazard reporting project in testing, not connected to municipal systems. Use Home and Map to explore issues, Report to submit a hazard, and My Issues to follow your reports. This help panel only explains the app.', hi: 'NagarTrace testing mein civic project hai, municipal systems se connected nahi hai. Home aur Map par issues dekhein, Report se hazard bhejein aur My Issues mein apni reports dekhein. Yeh help panel sirf app samjhata hai.', pa: 'NagarTrace testing vich civic project hai, municipal systems naal connected nahi hai. Home te Map utte issues vekho, Report naal hazard bhejo, te My Issues vich apnian reports vekho. Eh help panel sirf app samjhaunda hai.' } },
  { id: 'report', keys: 'report submit file pothole hazard gaddha complaint kaise kiven',
    q: { en: 'How do I report a hazard?', hi: 'Hazard report kaise karun?', pa: 'Hazard report kiven karaan?' },
    a: { en: 'Open Report and sign in if asked. Get your GPS position, select the hazard, take a photo at the spot, add a note if needed, then submit. This FAQ cannot file or change reports. Do not put a report or private details in the help search.', hi: 'Report kholein aur zaroorat ho to sign in karein. GPS position lein, hazard chunein, us jagah photo lein, zaroorat ho to note likhein, phir submit karein. FAQ reports bhej ya badal nahi sakta. Help search mein report ya personal details na likhein.', pa: 'Report kholo te je mange taan sign in karo. GPS position lao, hazard chuno, ose thaan photo lao, lor hove taan note likho, fer submit karo. FAQ report bhej jaan badal nahi sakda. Help search vich report jaan nijji jaankari na likho.' } },
  { id: 'gps', keys: 'gps location permission denied accuracy position map jagah',
    q: { en: 'Why does reporting need GPS?', hi: 'GPS ki zaroorat kyun hai?', pa: 'GPS di lor kyon hai?' },
    a: { en: 'GPS places the report on a road. Allow location access when the Report screen asks. If accuracy is too low, move into the open and retry. After refreshing your position, retake the photo at that spot. This FAQ does not request location.', hi: 'GPS report ko sadak par sahi jagah rakhta hai. Report screen ke poochhne par location access dein. Accuracy kam ho to khuli jagah jaakar dobara koshish karein. Position refresh karne ke baad us jagah photo dobara lein. FAQ location nahi maangta.', pa: 'GPS report nu sarak utte sahi thaan rakhda hai. Report screen de mangan te location access deo. Accuracy ghatt hove taan khulli thaan jaa ke fer koshish karo. Position refresh ton baad ose thaan photo dubara lao. FAQ location nahi mangda.' } },
  { id: 'photo', keys: 'photo camera image upload expired tasveer',
    q: { en: 'Why is a photo required?', hi: 'Photo kyun chahiye?', pa: 'Photo kyon chahidi hai?' },
    a: { en: 'The Report screen requires a hazard photo taken at your GPS spot before submitting. If the staged photo expires or the position changes, take it again. This FAQ has no photo upload or camera access.', hi: 'Report submit karne se pehle GPS wali jagah par hazard ki photo zaroori hai. Staged photo expire ho ya position badle to dobara photo lein. FAQ mein photo upload ya camera access nahi hai.', pa: 'Report submit karan ton pehlan GPS wali thaan te hazard di photo zaroori hai. Staged photo expire hove jaan position badle taan dubara photo lao. FAQ vich photo upload jaan camera access nahi hai.' } },
  { id: 'demo', keys: 'demo sample real database testing judges judge offline',
    q: { en: 'What does Demo Mode mean?', hi: 'Demo Mode kya hai?', pa: 'Demo Mode ki hai?' },
    a: { en: 'When the red DEMO MODE banner is visible, the app uses sample data and demo writes stay local instead of being sent to the real database. Profile has the demo switch: tap the version line 7 times. This FAQ is local in either mode; live reporting is a separate feature.', hi: 'Laal DEMO MODE banner dikhne par app sample data use karta hai aur demo writes real database mein nahi jaati. Profile mein version line ko 7 baar tap karke demo switch milega. FAQ dono modes mein local hai; live reporting alag feature hai.', pa: 'Laal DEMO MODE banner hove taan app sample data vartda hai te demo writes real database nu nahi jaandian. Profile vich version line nu 7 vaar tap karke demo switch milda hai. FAQ dovaan modes vich local hai; live reporting vakhra feature hai.' } },
  { id: 'ai', keys: 'ai chatbot bot help guide internet language privacy data hindi punjabi english',
    q: { en: 'Is this an AI chatbot?', hi: 'Kya yeh AI chatbot hai?', pa: 'Ki eh AI chatbot hai?' },
    a: { en: 'No. This is a fixed, local FAQ in English, Hindi and Punjabi (Roman script). Search matches help topics on your device; it does not generate answers, call an AI provider, or send your search off-device. It does not read your account, reports, photos or location. The existing AI Guide is separate and has its own controls.', hi: 'Nahi. Yeh English, Hindi aur Punjabi (Roman script) mein fixed local FAQ hai. Search device par help topics dhoondhta hai; naye jawab nahi banata, AI provider nahi bulata aur search bahar nahi bhejta. Yeh account, reports, photos ya location nahi padhta. Maujooda AI Guide alag hai aur uske apne controls hain.', pa: 'Nahi. Eh English, Hindi te Punjabi (Roman script) vich fixed local FAQ hai. Search device utte help topics labhda hai; nave jawab nahi banaunda, AI provider nu nahi bulaunda te search bahar nahi bhejda. Eh account, reports, photos jaan location nahi parhda. Maujooda AI Guide vakhra hai te usde apne controls han.' } },
]
const UI = {
  en: { title: 'NagarTrace Help', note: 'Local FAQ - not generative AI. No search leaves this device.', search: 'Search help topics', empty: 'No matching topic. Try a question below. This FAQ cannot answer everything.', close: 'Close help', back: 'All topics', hint: 'Do not enter personal details. Use Report to file a hazard.' },
  hi: { title: 'NagarTrace Madad', note: 'Local FAQ - generative AI nahi. Search device se bahar nahi jaata.', search: 'Help topics dhoondhein', empty: 'Topic nahi mila. Neeche ke sawaal dekhein. FAQ har sawaal ka jawab nahi de sakta.', close: 'Madad band karein', back: 'Sabhi topics', hint: 'Personal details na likhein. Hazard bhejne ke liye Report kholein.' },
  pa: { title: 'NagarTrace Madad', note: 'Local FAQ - generative AI nahi. Search device ton bahar nahi jaanda.', search: 'Help topics labho', empty: 'Topic nahi labhya. Hethle sawaal vekho. FAQ har sawaal da jawab nahi de sakda.', close: 'Madad band karo', back: 'Saare topics', hint: 'Nijji jaankari na likho. Hazard bhejan layi Report kholo.' },
}
export function LocalFaq() {
  const [open, setOpen] = useState(false)
  const [lang, setLang] = useState<Lang>('en')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const ui = UI[lang]
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const matches = FAQ.filter(e => terms.length === 0 || terms.some(t => `${e.keys} ${e.q[lang]}`.toLowerCase().includes(t)))
  const entry = FAQ.find(e => e.id === selected)
  const close = () => { setOpen(false); setQuery(''); setSelected(null) }
  return (
    <>
      <button className="faq-launcher" aria-label="Open local FAQ help" onClick={() => setOpen(true)}>? Help</button>
      {open ? (
        <div className="faq-overlay" role="dialog" aria-modal="true" aria-label={ui.title} onClick={(e) => { if (e.target === e.currentTarget) close() }}>
          <div className="faq-panel">
            <div className="faq-header">
              <strong>{ui.title}</strong>
              <button className="btn ghost small" aria-label={ui.close} onClick={close}>X</button>
            </div>
            <div className="faq-body">
              <p className="faq-note">{ui.note}</p>
              <div className="faq-langs">
                {(['en', 'hi', 'pa'] as Lang[]).map(l => (
                  <button key={l} className={`faq-lang${l === lang ? ' active' : ''}`} aria-pressed={l === lang} onClick={() => setLang(l)}>
                    {l === 'en' ? 'English' : l === 'hi' ? 'Hindi' : 'Punjabi'}
                  </button>
                ))}
              </div>
              <p className="faq-hint">{ui.hint}</p>
              <input className="faq-input" value={query} placeholder={ui.search} aria-label={ui.search} onChange={(e) => { setQuery(e.target.value); setSelected(null) }} />
              {entry ? (
                <div className="faq-answer">
                  <strong>{entry.q[lang]}</strong>
                  <p>{entry.a[lang]}</p>
                  <button className="btn ghost small" onClick={() => setSelected(null)}>{ui.back}</button>
                </div>
              ) : (
                <>
                  {query.trim() && matches.length === 0 ? <p className="faq-hint">{ui.empty}</p> : null}
                  <div className="faq-topics">
                    {matches.map(e => (
                      <button key={e.id} className="faq-topic" onClick={() => setSelected(e.id)}>
                        <span>{e.q[lang]}</span><span aria-hidden="true">&rsaquo;</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
