# Guide content, in English. Turned into pages by guides/generer.py.
# Same rule as the French: nothing made up, Google's review rules respected.

GUIDES = [
  dict(
    slug='more-google-reviews',
    fr='plus-d-avis-google',
    titre='How to get more Google reviews: a guide for local businesses',
    court='How to get more Google reviews',
    desc='The habits that actually grow a business’s Google reviews: ask at the right moment, ask everyone, make it one gesture — and what Google forbids.',
    lecture=7,
    intro='Your customers are happy, but your Google profile doesn’t show it yet? That’s normal: most people don’t think of it on their own. Here’s how to turn happy customers into reviews, step by step — without breaking Google’s rules.',
    sections=[
      ('Why reviews matter so much', '''
<p>When someone searches “coffee near me” or “mechanic in Laval”, Google shows a map with a few businesses, their rating and their number of reviews. That’s often where the choice is made, before anyone visits a website.</p>
<p>Google says so itself in its help on local ranking: <strong>review count and score</strong> are among the signals that influence a business’s position in local results. More recent reviews means more visibility <em>and</em> more trust.</p>
'''),
      ('The golden rule: ask — and ask everyone', '''
<p>A happy customer rarely leaves a review unprompted. Not for lack of goodwill: they simply don’t think of it, or don’t know where to tap. The fix is simple, but it has to happen <strong>at every visit</strong>: ask.</p>
<p>And ask <strong>everyone</strong>. Google forbids asking only the customers you think are happy. It also works better over time: a profile with many varied reviews earns more trust than a perfect one with ten.</p>
'''),
      ('Seven habits that make the difference', '''
<ol>
<li><strong>A direct “Write a review” link.</strong> In your Google Business Profile, the “Ask for reviews” option gives you a link that opens the review window directly. Every click you remove is one more customer who follows through.</li>
<li><strong>The right moment.</strong> At the end of the visit: at checkout, when handing back the keys, while bagging the order. The experience is still fresh.</li>
<li><strong>One short, sincere line.</strong> No speech: one line, always the same, that the whole team knows (see below).</li>
<li><strong>One gesture for the customer.</strong> The simpler, the better. An NFC card on the counter opens the review page when the phone comes close: no app, no link to type.</li>
<li><strong>The whole team on board.</strong> A thirty-second reminder at the start of each shift is enough. A card nobody mentions works far less.</li>
<li><strong>Reply to reviews.</strong> Thank the positive ones, answer the negative ones calmly. Google recommends replying: it shows you read them, and customers who see it are more inclined to write their own.</li>
<li><strong>Track your numbers.</strong> How many customers opened the review page this week? Which day, what time? Without measuring, you can’t tell whether a change helps.</li>
</ol>
'''),
      ('The line that works', '''
<p>Short, sincere, and it tells people how little effort it takes:</p>
<p class="phrase">“If you enjoyed it, a quick Google review helps us a ton — it takes ten seconds!”</p>
<p>Add the gesture: show the card or the link. And reassure: “One sentence is plenty.” What often holds people back is the fear of having to write an essay.</p>
'''),
      ('What Google forbids (and so does the law)', '''
<div class="encadre encadre-attention">
<ul>
<li><strong>Offering a reward for a review</strong>: discounts, a free coffee, a draw. Google forbids it, even if the review could be negative.</li>
<li><strong>Asking only happy customers</strong> (known as <em>review gating</em>) or discouraging negative reviews.</li>
<li><strong>Writing fake reviews, buying them</strong>, or having family and staff write them. In Canada, fake reviews can also breach the Competition Act.</li>
</ul>
</div>
<p>Reviews that break these rules can be removed by Google, and the profile can be penalized. The good news: the honest method — asking everyone at the right moment — is also the one that works best.</p>
'''),
      ('What about negative reviews?', '''
<p>They’re part of the game, and a 4.7 with a few critiques often looks more credible than a perfect 5.0. Reply quickly and politely, don’t argue in public, and offer to sort things out privately. If a review breaks Google’s rules (hate speech, fake customer, conflict of interest), you can flag it from your profile.</p>
'''),
    ],
    faq=[
      ('How long before a review shows up?', 'Usually quickly, but Google may delay or filter some reviews, for instance when many arrive at once from the same place. One more reason to aim for a steady pace rather than a one-day push.'),
      ('Can I get a bad review removed?', 'Only if it breaks Google’s rules: then you can flag it from your profile. A review that is simply negative stays up; the best answer is a calm, helpful public reply.'),
      ('How many reviews should I aim for?', 'There’s no magic number. Compare yourself with similar businesses nearby, and aim above all for consistency: a few reviews every week beat one burst followed by months of silence.'),
    ],
  ),
  dict(
    slug='nfc-google-review-card',
    fr='carte-nfc-avis-google',
    titre='NFC Google review cards: how do they work?',
    court='NFC Google review cards: how they work',
    desc='What an NFC Google review card is, how phones read it, which phones are compatible, and where to place it so it actually gets used.',
    lecture=6,
    intro='The customer holds their phone near the card and your Google “Write a review” page opens. No app, no link to type. Here’s what actually happens inside the card, and how to get the most out of it.',
    sections=[
      ('NFC in two sentences', '''
<p>NFC stands for <em>Near Field Communication</em>: a wireless link that only works within a few centimetres. It’s the same technology as tap-to-pay — your customers already make this gesture several times a week.</p>
<p>The card holds a tiny chip and an antenna, <strong>with no battery</strong>: the phone powers it for the moment it’s read. It doesn’t wear out with use.</p>
'''),
      ('What’s inside the chip', '''
<p>A web address, nothing more. When the phone reads the chip, it opens that address in the browser, as if you had tapped a link.</p>
<p>There are two ways to do it:</p>
<ul>
<li><strong>Write the Google review link straight into the chip.</strong> Simple, but frozen: if the link changes, or you want to send people to your menu one day, the card has to be reprogrammed. And you never know how often it’s used.</li>
<li><strong>Write an intermediate address that redirects</strong> (that’s what Tapora does). The destination can be changed remotely at any time, and every tap is counted: you see how many customers opened the page, on which day and at what time.</li>
</ul>
'''),
      ('Which phones are compatible?', '''
<ul>
<li><strong>iPhone</strong>: since the iPhone XS and XR (2018), NFC cards are read with no app, with the phone unlocked. The <strong>top</strong> of the phone reads the card.</li>
<li><strong>Android</strong>: the vast majority of phones have NFC, often already on because it’s used for tap-to-pay. The reader is usually in the <strong>middle of the back</strong>. If nothing happens, NFC may be turned off in the settings.</li>
</ul>
<p>The phone needs internet to open the Google page; the card itself needs nothing.</p>
'''),
      ('Where to place the card', '''
<ul>
<li><strong>Where hands already are</strong>: next to the payment terminal, on the counter, on the table, with the bill.</li>
<li><strong>At eye or hand level</strong>, never hidden behind the register.</li>
<li><strong>Not on a metal surface</strong>: metal interferes with NFC reading. On a metal counter, use a stand or holder.</li>
<li><strong>One card for each spot where customers wait</strong>: register, tables, waiting room, reception.</li>
</ul>
<div class="encadre"><p><strong>Tip:</strong> show the gesture the first time — “hold the top of your phone here”. A two-second demo and customers stop fumbling.</p></div>
'''),
      ('What the card doesn’t do', '''
<p>It doesn’t replace asking. A card left alone on a counter gets used far less than one the team mentions in a sentence. It doesn’t collect data about the person either: a Tapora card only keeps the time of the tap and the type of phone, in line with Québec’s Law 25.</p>
'''),
    ],
    faq=[
      ('Do customers need an app to read the card?', 'No. Recent iPhones and the vast majority of Android phones read the card with nothing to install.'),
      ('Does the card work through a phone case?', 'Through most slim cases, yes. A very thick case, or one with metal (magnetic mount, metal card holder), can block the reading.'),
      ('How long does an NFC card last?', 'With no battery and no moving parts, it lasts for years. What wears it out is physical damage: keep it clean and away from knocks.'),
    ],
  ),
  dict(
    slug='subscription-or-one-time-payment',
    fr='abonnement-ou-paiement-unique',
    titre='Google review cards: subscription or one-time payment?',
    court='Subscription or one-time payment',
    desc='Compare the three ways to buy NFC Google review cards — plain card, card with a subscription, all-included card — and the questions to ask before you buy.',
    lecture=6,
    intro='A Google review card can cost a few dollars or turn into a monthly expense. Before you buy, it’s worth understanding what you’re really paying for — today, and two years from now.',
    sections=[
      ('The three models on the market', '''
<p class="indice-tableau">Swipe the table sideways →</p>
<div class="tableau"><table>
<thead><tr><th></th><th>Plain card</th><th>Card + subscription</th><th>All-included card</th></tr></thead>
<tbody>
<tr><th>What you pay</th><td>The card, once</td><td>The card, then every month</td><td>The card, once</td></tr>
<tr><th>Changeable destination</th><td>By reprogramming the card</td><td>Usually yes</td><td>Yes, remotely</td></tr>
<tr><th>Tap counts</th><td>No</td><td>Yes</td><td>Yes</td></tr>
<tr><th>If you stop paying</th><td>Nothing changes</td><td>Check: the card may stop redirecting</td><td>Nothing changes</td></tr>
</tbody>
</table></div>
'''),
      ('Do the math over two years', '''
<p>A subscription looks small each month, but it adds up. A purely arithmetic example: a $30 card plus a $15 monthly subscription comes to <strong>$390</strong> after two years (30 + 24 × 15). With a one-time $30 payment, you stay at $30.</p>
<p>A subscription can make sense if it truly brings more — but you should know before you buy, and compare.</p>
'''),
      ('Six questions to ask before buying', '''
<ol>
<li><strong>What happens if I stop paying?</strong> Does the card keep working, or does it stop redirecting?</li>
<li><strong>Can I change the destination myself, or on request, without reprogramming the card?</strong></li>
<li><strong>What exactly will I see?</strong> Tap counts? By day, by hour? Reviews gained?</li>
<li><strong>What data is collected about my customers?</strong> In Québec, Law 25 governs personal information: the less, the better.</li>
<li><strong>Is there support in my language, with someone who answers?</strong></li>
<li><strong>What’s the total price for the number of cards I need?</strong> Register, tables, reception: you often want more than one.</li>
</ol>
'''),
      ('Tapora’s choice', '''
<p>At Tapora we chose a one-time payment: <strong>$30 for one card, $55 for two, then $27.50 per card</strong> from three. The changeable destination, the private live stats page, a notification on every tap, counter mode and the monthly report are included, <strong>with no subscription or monthly fee</strong>. Details are in our <a href="/en/terms">terms</a>.</p>
'''),
    ],
    faq=[
      ('Can an NFC card without a subscription still give me stats?', 'Yes, if it goes through an intermediate address that counts taps. That’s how Tapora cards work, with no monthly fee.'),
      ('Can I program an NFC card myself?', 'Yes, with an NFC writing app and a blank card. You’ll get a card that works, but frozen and without stats.'),
    ],
  ),
  dict(
    slug='google-reviews-restaurants-cafes',
    fr='avis-google-restaurants-cafes',
    titre='Google reviews for restaurants, cafés and bakeries',
    court='Google reviews for restaurants and cafés',
    desc='Where to place the card, when to ask and what to say in food service: a hands-on guide for restaurants, cafés and bakeries.',
    lecture=5,
    intro='In food service, the window to ask for a review is short: a few seconds between the bill and the door. Here’s how to make the most of it, at the counter and in the dining room.',
    sections=[
      ('At the counter: café, bakery, quick service', '''
<ul>
<li><strong>Next to the payment terminal.</strong> It’s the one spot where every customer stops, phone or credit card already in hand.</li>
<li><strong>When handing over the order</strong>, one line: “If you enjoyed it, a quick review helps us a lot!”</li>
<li><strong>For takeout</strong>, a small card on the pickup counter, where people wait.</li>
</ul>
'''),
      ('In the dining room: table service', '''
<ul>
<li><strong>With the bill</strong>: the card in the bill folder, or shown at payment.</li>
<li><strong>On every table</strong>, in a small stand: customers see it while they wait.</li>
<li><strong>The server mentions it</strong> in one line, when the customer thanks them for the meal.</li>
</ul>
<div class="encadre"><p><strong>Peak hours matter.</strong> If your stats show most taps come between noon and 2 pm, the lunch team should know the card best.</p></div>
'''),
      ('The line, in English and French', '''
<p class="phrase">“If you enjoyed it, a quick Google review helps us a ton — it takes ten seconds!”</p>
<p class="phrase">« Si vous avez aimé, un petit avis Google nous aide énormément — ça prend dix secondes ! »</p>
'''),
      ('What not to do', '''
<div class="encadre encadre-attention">
<ul>
<li>Offering a dessert, a coffee or a discount in exchange for a review: Google forbids it, even for “an honest review”.</li>
<li>Showing the card only to tables that look happy: Google forbids asking only satisfied customers.</li>
<li>Asking staff or family to write reviews.</li>
</ul>
</div>
'''),
      ('Replying to reviews', '''
<p>Say thanks and mention a detail (“Thank you, glad you enjoyed the soup of the day!”). For criticism, reply quickly and calmly, and invite them back or to write to you. Future customers read the replies as much as the reviews.</p>
'''),
    ],
    faq=[
      ('How many cards does a restaurant need?', 'One at the register, then one for each area where customers wait or pay: tables, patio, pickup counter. Many start with two or three cards.'),
      ('Do the cards hold up to tables being wiped all day?', 'An NFC card has no battery; a damp cloth does nothing to it. Just don’t leave it soaking, or on a metal surface.'),
    ],
  ),
  dict(
    slug='google-reviews-salons-clinics-garages',
    fr='avis-google-salons-cliniques-garages',
    titre='Google reviews for salons, clinics, garages and services',
    court='Google reviews for salons, clinics and garages',
    desc='How to ask for Google reviews in an appointment-based business — salon, clinic, garage, studio — while respecting Google’s rules, Québec’s Law 25 and Canada’s anti-spam law.',
    lecture=6,
    intro='In an appointment-based business, you know your customers and you have time with them. That’s a huge advantage for reviews — as long as you ask at the right moment and follow a few rules specific to your field.',
    sections=[
      ('The right moment: at the end, not during', '''
<ul>
<li><strong>Hair or beauty salon</strong>: when the client sees themselves in the mirror, and at checkout.</li>
<li><strong>Clinic</strong>: at reception, when booking the next appointment or paying.</li>
<li><strong>Garage</strong>: when handing back the keys, once the work has been explained.</li>
<li><strong>Studio, gym, classes</strong>: at the end of a session, not the start.</li>
</ul>
'''),
      ('Where to place the card', '''
<p>At reception, next to the payment terminal: every customer passes through there. A second card in the waiting room works well too: people have their phone in hand and time to spare.</p>
'''),
      ('Sending the link by text or email?', '''
<p>You can, but two laws apply:</p>
<ul>
<li><strong>Canada’s Anti-Spam Legislation (CASL)</strong> governs commercial electronic messages. Make sure you have the customer’s consent to write to them, and offer an easy way to stop receiving messages.</li>
<li><strong>Québec’s Law 25</strong> governs the use of personal information: only use contact details for the purposes the customer gave them for.</li>
</ul>
<p>A card at the counter avoids these questions: the customer makes the gesture themselves, without you having to write to them.</p>
'''),
      ('Clinics and regulated professions: care in your replies', '''
<div class="encadre encadre-attention">
<p>When you reply to a review, <strong>never confirm that someone is your patient or client</strong>, and give no detail about any treatment or file — even if the person mentions it themselves. A general reply (“Thank you for your message; please call us to discuss it”) protects confidentiality. Also check your professional order’s rules on advertising and testimonials.</p>
</div>
'''),
      ('Google’s rules, for everyone', '''
<ul>
<li>No reward for a review (discount on the next appointment, free product).</li>
<li>Ask every customer, not only the ones who seem happy.</li>
<li>No reviews written by staff, family or accounts created for the occasion.</li>
</ul>
'''),
    ],
    faq=[
      ('Can I ask a regular customer for a review?', 'Yes, any customer. A loyal customer who has never left a review is often the happiest to do it: you just have to ask.'),
      ('What if a customer leaves an unfair negative review?', 'Reply calmly and in general terms, with no personal detail. If it breaks Google’s rules (fake customer, hate speech), flag it from your profile.'),
    ],
  ),
]

INDEX = dict(
  titre='Guides: more Google reviews for your business',
  desc='Practical, honest guides to getting more Google reviews: how to ask, NFC cards, subscription or one-time payment, restaurants, salons, clinics and garages.',
  h1='Tapora guides',
  intro='Practical advice for getting more Google reviews — by the rules. Written for local businesses.',
)
