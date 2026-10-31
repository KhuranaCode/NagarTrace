// Local multilingual FAQ - code-only port of the reviewed mobile component
// (mananbharti/NagarTrace-mobile feat/local-faq bfc841e). No network, no storage,
// no provider, no account data: fixed content + transient in-memory search only.
// Hindi content is Devanagari, Punjabi content is Gurmukhi; English unchanged.
import { useState } from 'react'

type Lang = 'en' | 'hi' | 'pa'
type Entry = { id: string; keys: string; q: Record<Lang, string>; a: Record<Lang, string> }
const FAQ: Entry[] = [
  { id: 'about', keys: 'about what nagartrace kya ki hai project testing क्या प्रोजेक्ट टेस्टिंग ਕੀ ਪ੍ਰੋਜੈਕਟ ਟੈਸਟਿੰਗ',
    q: { en: 'What is NagarTrace?', hi: 'NagarTrace क्या है?', pa: 'NagarTrace ਕੀ ਹੈ?' },
    a: { en: 'NagarTrace is a civic road-hazard reporting project in testing, not connected to municipal systems. Use Home and Map to explore issues, Report to submit a hazard, and My Issues to follow your reports. This help panel only explains the app.', hi: 'NagarTrace एक नागरिक सड़क-ख़तरा रिपोर्टिंग प्रोजेक्ट है जो अभी टेस्टिंग में है; यह नगरपालिका प्रणालियों से जुड़ा नहीं है। मुद्दे देखने के लिए Home और Map का उपयोग करें, ख़तरा भेजने के लिए Report, और अपनी रिपोर्टें देखने के लिए My Issues। यह मदद पैनल केवल ऐप समझाता है।', pa: 'NagarTrace ਇੱਕ ਨਾਗਰਿਕ ਸੜਕ-ਖ਼ਤਰਾ ਰਿਪੋਰਟਿੰਗ ਪ੍ਰੋਜੈਕਟ ਹੈ ਜੋ ਟੈਸਟਿੰਗ ਵਿੱਚ ਹੈ; ਇਹ ਮਿਊਂਸੀਪਲ ਸਿਸਟਮਾਂ ਨਾਲ ਜੁੜਿਆ ਨਹੀਂ ਹੈ। ਮੁੱਦੇ ਵੇਖਣ ਲਈ Home ਅਤੇ Map ਵਰਤੋ, ਖ਼ਤਰਾ ਭੇਜਣ ਲਈ Report, ਅਤੇ ਆਪਣੀਆਂ ਰਿਪੋਰਟਾਂ ਵੇਖਣ ਲਈ My Issues। ਇਹ ਮਦਦ ਪੈਨਲ ਸਿਰਫ਼ ਐਪ ਸਮਝਾਉਂਦਾ ਹੈ।' } },
  { id: 'report', keys: 'report submit file pothole hazard gaddha complaint kaise kiven कैसे रिपोर्ट शिकायत गड्ढा कैसे ਸ਼ਿਕਾਇਤ ਰਿਪੋਰਟ',
    q: { en: 'How do I report a hazard?', hi: 'ख़तरा कैसे रिपोर्ट करूँ?', pa: 'ਖ਼ਤਰਾ ਕਿਵੇਂ ਰਿਪੋਰਟ ਕਰਾਂ?' },
    a: { en: 'Open Report and sign in if asked. Get your GPS position, select the hazard, take a photo at the spot, add a note if needed, then submit. This FAQ cannot file or change reports. Do not put a report or private details in the help search.', hi: 'Report खोलें और माँगे जाने पर साइन इन करें। अपनी GPS लोकेशन लें, ख़तरा चुनें, उसी जगह फ़ोटो लें, ज़रूरत हो तो नोट जोड़ें, फिर सबमिट करें। यह FAQ रिपोर्ट दर्ज या बदल नहीं सकता। मदद सर्च में रिपोर्ट या निजी जानकारी न लिखें।', pa: 'Report ਖੋਲ੍ਹੋ ਅਤੇ ਮੰਗੇ ਜਾਣ ਤੇ ਸਾਈਨ ਇਨ ਕਰੋ। ਆਪਣੀ GPS ਲੋਕੇਸ਼ਨ ਲਓ, ਖ਼ਤਰਾ ਚੁਣੋ, ਉਸੇ ਥਾਂ ਫੋਟੋ ਲਓ, ਲੋੜ ਹੋਵੇ ਤਾਂ ਨੋਟ ਜੋੜੋ, ਫਿਰ ਸਬਮਿਟ ਕਰੋ। ਇਹ FAQ ਰਿਪੋਰਟ ਦਰਜ ਜਾਂ ਬਦਲ ਨਹੀਂ ਸਕਦਾ। ਮਦਦ ਖੋਜ ਵਿੱਚ ਰਿਪੋਰਟ ਜਾਂ ਨਿੱਜੀ ਜਾਣਕਾਰੀ ਨਾ ਲਿਖੋ।' } },
  { id: 'gps', keys: 'gps location permission denied accuracy position map jagah लोकेशन जगह नक्शा अनुमति ਸਥਾਨ ਲੋਕੇਸ਼ਨ ਇਜਾਜ਼ਤ ਨਕਸ਼ਾ',
    q: { en: 'Why does reporting need GPS?', hi: 'रिपोर्टिंग के लिए GPS की ज़रूरत क्यों है?', pa: 'ਰਿਪੋਰਟਿੰਗ ਲਈ GPS ਦੀ ਲੋੜ ਕਿਉਂ ਹੈ?' },
    a: { en: 'GPS places the report on a road. Allow location access when the Report screen asks. If accuracy is too low, move into the open and retry. After refreshing your position, retake the photo at that spot. This FAQ does not request location.', hi: 'GPS रिपोर्ट को सड़क पर सही जगह दिखाता है। Report स्क्रीन माँगे तो लोकेशन एक्सेस दें। सटीकता कम हो तो खुली जगह जाकर दोबारा कोशिश करें। लोकेशन रीफ्रेश करने के बाद उसी जगह फ़ोटो दोबारा लें। यह FAQ लोकेशन नहीं माँगता।', pa: 'GPS ਰਿਪੋਰਟ ਨੂੰ ਸੜਕ ਤੇ ਸਹੀ ਥਾਂ ਦਿਖਾਉਂਦਾ ਹੈ। Report ਸਕ੍ਰੀਨ ਮੰਗੇ ਤਾਂ ਲੋਕੇਸ਼ਨ ਐਕਸੈਸ ਦਿਓ। ਸ਼ੁੱਧਤਾ ਘੱਟ ਹੋਵੇ ਤਾਂ ਖੁੱਲ੍ਹੀ ਥਾਂ ਜਾ ਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ। ਲੋਕੇਸ਼ਨ ਰੀਫ੍ਰੈਸ਼ ਕਰਨ ਤੋਂ ਬਾਅਦ ਉਸੇ ਥਾਂ ਫੋਟੋ ਦੁਬਾਰਾ ਲਓ। ਇਹ FAQ ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਮੰਗਦਾ।' } },
  { id: 'photo', keys: 'photo camera image upload expired tasveer फ़ोटो कैमरा तस्वीर अपलोड ਫੋਟੋ ਕੈਮਰਾ ਤਸਵੀਰ ਅੱਪਲੋਡ',
    q: { en: 'Why is a photo required?', hi: 'फ़ोटो क्यों ज़रूरी है?', pa: 'ਫੋਟੋ ਕਿਉਂ ਜ਼ਰੂਰੀ ਹੈ?' },
    a: { en: 'The Report screen requires a hazard photo taken at your GPS spot before submitting. If the staged photo expires or the position changes, take it again. This FAQ has no photo upload or camera access.', hi: 'सबमिट करने से पहले Report स्क्रीन पर अपनी GPS जगह की ख़तरे की फ़ोटो ज़रूरी है। रखी हुई फ़ोटो एक्सपायर हो जाए या लोकेशन बदल जाए तो फ़ोटो दोबारा लें। इस FAQ में फ़ोटो अपलोड या कैमरा एक्सेस नहीं है।', pa: 'ਸਬਮਿਟ ਕਰਨ ਤੋਂ ਪਹਿਲਾਂ Report ਸਕ੍ਰੀਨ ਤੁਹਾਡੀ GPS ਥਾਂ ਦੀ ਖ਼ਤਰੇ ਦੀ ਫੋਟੋ ਮੰਗਦੀ ਹੈ। ਜੇ ਰੱਖੀ ਫੋਟੋ ਐਕਸਪਾਇਰ ਹੋ ਜਾਵੇ ਜਾਂ ਲੋਕੇਸ਼ਨ ਬਦਲ ਜਾਵੇ ਤਾਂ ਫੋਟੋ ਦੁਬਾਰਾ ਲਓ। ਇਸ FAQ ਵਿੱਚ ਫੋਟੋ ਅੱਪਲੋਡ ਜਾਂ ਕੈਮਰਾ ਐਕਸੈਸ ਨਹੀਂ ਹੈ।' } },
  { id: 'demo', keys: 'demo sample real database testing judges judge offline डेमो नमूना असली डेटाबेस ਡੈਮੋ ਨਮੂਨਾ ਅਸਲੀ ਡੇਟਾਬੇਸ',
    q: { en: 'What does Demo Mode mean?', hi: 'Demo Mode क्या है?', pa: 'Demo Mode ਕੀ ਹੈ?' },
    a: { en: 'When the red DEMO MODE banner is visible, the app uses sample data and demo writes stay local instead of being sent to the real database. Profile has the demo switch: tap the version line 7 times. This FAQ is local in either mode; live reporting is a separate feature.', hi: 'जब लाल DEMO MODE बैनर दिखे, तो ऐप सैंपल डेटा इस्तेमाल करता है और डेमो में किए बदलाव असली डेटाबेस में नहीं जाते। Profile में डेमो स्विच है: वर्ज़न लाइन को 7 बार टैप करें। यह FAQ दोनों मोड में लोकल है; लाइव रिपोर्टिंग एक अलग फ़ीचर है।', pa: 'ਜਦੋਂ ਲਾਲ DEMO MODE ਬੈਨਰ ਦਿਖੇ, ਤਾਂ ਐਪ ਸੈਂਪਲ ਡਾਟਾ ਵਰਤਦਾ ਹੈ ਅਤੇ ਡੈਮੋ ਵਿੱਚ ਕੀਤੇ ਬਦਲਾਅ ਅਸਲੀ ਡੇਟਾਬੇਸ ਵਿੱਚ ਨਹੀਂ ਜਾਂਦੇ। Profile ਵਿੱਚ ਡੈਮੋ ਸਵਿੱਚ ਹੈ: ਵਰਜ਼ਨ ਲਾਈਨ ਨੂੰ 7 ਵਾਰ ਟੈਪ ਕਰੋ। ਇਹ FAQ ਦੋਵੇਂ ਮੋਡਾਂ ਵਿੱਚ ਲੋਕਲ ਹੈ; ਲਾਈਵ ਰਿਪੋਰਟਿੰਗ ਵੱਖਰਾ ਫੀਚਰ ਹੈ।' } },
  { id: 'ai', keys: 'ai chatbot bot help guide internet language privacy data hindi punjabi english एआई चैटबॉट मदद गाइड इंटरनेट भाषा निजता डेटा हिंदी पंजाबी ਏਆਈ ਚੈਟਬੋਟ ਮਦਦ ਗਾਈਡ ਇੰਟਰਨੈੱਟ ਭਾਸ਼ਾ ਨਿੱਜਤਾ ਡਾਟਾ ਹਿੰਦੀ ਪੰਜਾਬੀ',
    q: { en: 'Is this an AI chatbot?', hi: 'क्या यह AI चैटबॉट है?', pa: 'ਕੀ ਇਹ AI ਚੈਟਬੋਟ ਹੈ?' },
    a: { en: 'No. This is a fixed, local FAQ in English, Hindi (Devanagari) and Punjabi (Gurmukhi). Search matches help topics on your device; it does not generate answers, call an AI provider, or send your search off-device. It does not read your account, reports, photos or location. The existing AI Guide is separate and has its own controls.', hi: 'नहीं। यह English, हिंदी और पंजाबी में एक तयशुदा लोकल FAQ है। सर्च आपके डिवाइस पर ही मदद विषयों से मिलान करती है; यह नए जवाब नहीं बनाती, किसी AI प्रोवाइडर को कॉल नहीं करती और आपकी सर्च को डिवाइस से बाहर नहीं भेजती। यह आपका अकाउंट, रिपोर्टें, फ़ोटो या लोकेशन नहीं पढ़ती। मौजूदा AI Guide अलग है और उसके अपने कंट्रोल हैं।', pa: 'ਨਹੀਂ। ਇਹ English, ਹਿੰਦੀ ਅਤੇ ਪੰਜਾਬੀ ਵਿੱਚ ਇੱਕ ਤੈਅ ਕੀਤਾ ਲੋਕਲ FAQ ਹੈ। ਖੋਜ ਤੁਹਾਡੇ ਡਿਵਾਈਸ ਤੇ ਹੀ ਮਦਦ ਵਿਸ਼ਿਆਂ ਨਾਲ ਮਿਲਾਨ ਕਰਦੀ ਹੈ; ਇਹ ਨਵੇਂ ਜਵਾਬ ਨਹੀਂ ਬਣਾਉਂਦੀ, ਕਿਸੇ AI ਪ੍ਰੋਵਾਈਡਰ ਨੂੰ ਕਾਲ ਨਹੀਂ ਕਰਦੀ ਅਤੇ ਤੁਹਾਡੀ ਖੋਜ ਡਿਵਾਈਸ ਤੋਂ ਬਾਹਰ ਨਹੀਂ ਭੇਜਦੀ। ਇਹ ਤੁਹਾਡਾ ਅਕਾਉਂਟ, ਰਿਪੋਰਟਾਂ, ਫੋਟੋਆਂ ਜਾਂ ਲੋਕੇਸ਼ਨ ਨਹੀਂ ਪੜ੍ਹਦੀ। ਮੌਜੂਦਾ AI Guide ਵੱਖਰਾ ਹੈ ਅਤੇ ਉਸਦੇ ਆਪਣੇ ਕੰਟਰੋਲ ਹਨ।' } },
]
const UI = {
  en: { title: 'NagarTrace Help', note: 'Local FAQ - not generative AI. No search leaves this device.', search: 'Search help topics', empty: 'No matching topic. Try a question below. This FAQ cannot answer everything.', close: 'Close help', back: 'All topics', hint: 'Do not enter personal details. Use Report to file a hazard.' },
  hi: { title: 'NagarTrace मदद', note: 'लोकल FAQ - जनरेटिव AI नहीं। आपकी सर्च इस डिवाइस से बाहर नहीं जाती।', search: 'मदद के विषय खोजें', empty: 'कोई मेल खाता विषय नहीं मिला। नीचे दिया कोई सवाल आज़माएँ। यह FAQ हर सवाल का जवाब नहीं दे सकता।', close: 'मदद बंद करें', back: 'सभी विषय', hint: 'निजी जानकारी न लिखें। ख़तरा दर्ज करने के लिए Report खोलें।' },
  pa: { title: 'NagarTrace ਮਦਦ', note: 'ਲੋਕਲ FAQ - ਜਨਰੇਟਿਵ AI ਨਹੀਂ। ਤੁਹਾਡੀ ਖੋਜ ਇਸ ਡਿਵਾਈਸ ਤੋਂ ਬਾਹਰ ਨਹੀਂ ਜਾਂਦੀ।', search: 'ਮਦਦ ਵਿਸ਼ੇ ਲੱਭੋ', empty: 'ਕੋਈ ਮਿਲਦਾ ਵਿਸ਼ਾ ਨਹੀਂ ਲੱਭਿਆ। ਹੇਠਾਂ ਦਿੱਤਾ ਕੋਈ ਸਵਾਲ ਅਜ਼ਮਾਓ। ਇਹ FAQ ਹਰ ਸਵਾਲ ਦਾ ਜਵਾਬ ਨਹੀਂ ਦੇ ਸਕਦਾ।', close: 'ਮਦਦ ਬੰਦ ਕਰੋ', back: 'ਸਾਰੇ ਵਿਸ਼ੇ', hint: 'ਨਿੱਜੀ ਜਾਣਕਾਰੀ ਨਾ ਲਿਖੋ। ਖ਼ਤਰਾ ਦਰਜ ਕਰਨ ਲਈ Report ਖੋਲ੍ਹੋ।' },
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
                    {l === 'en' ? 'English' : l === 'hi' ? 'हिन्दी' : 'ਪੰਜਾਬੀ'}
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
