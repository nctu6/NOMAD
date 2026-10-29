import type { TranslationStrings } from '../types';

const demo: TranslationStrings = {
  // The welcome dialog a demo instance opens with (components/Demo/DemoWelcome).
  'demo.welcome.eyebrow': 'Ζωντανή επίδειξη',
  'demo.welcome.title': 'Καλώς ήρθες στο TREK',
  'demo.welcome.tagline':
    'Ο ταξιδιωτικός σχεδιαστής για να μοιράζεσαι: σχεδιάστε μαζί στον χάρτη σε πραγματικό χρόνο, από την πρώτη ιδέα ως το φωτοβιβλίο μετά το ταξίδι.',
  'demo.welcome.resetTitle': 'Όλα επαναφέρονται κάθε ώρα',
  'demo.welcome.resetBody':
    'Εξερεύνησε, επεξεργάσου και δημιούργησε όσο θέλεις. Κάθε ακέραιη ώρα η επίδειξη επιστρέφει στην αρχική της κατάσταση για τον επόμενο επισκέπτη.',
  'demo.welcome.resetIn': 'Επόμενη επαναφορά σε',
  'demo.welcome.tryTitle': 'Δοκίμασέ το τώρα',
  'demo.feature.planner.title': 'Σχεδιαστής ταξιδιών',
  'demo.feature.planner.body':
    'Μέρες, μέρη και διαδρομές στον χάρτη, με πτήσεις, ξενοδοχεία, εστιατόρια, κρατήσεις και κοινά έξοδα.',
  'demo.feature.tours.title': 'Διαδρομές και πεζοπορίες',
  'demo.feature.tours.body':
    'Σχεδίασε μια πεζοπορία στο δίκτυο μονοπατιών και ακολούθησέ την πάνω σε 3D ανάγλυφο με το υψομετρικό της προφίλ.',
  'demo.feature.studio.title': 'Φωτοβιβλία με το TREK Studio',
  'demo.feature.studio.body': 'Κάνε ένα ταξίδι σχεδιασμένο φωτοβιβλίο, σελίδα προς σελίδα.',
  'demo.feature.collab.title': 'Σχεδιάστε μαζί ζωντανά',
  'demo.feature.collab.body': 'Όλοι στο ταξίδι βλέπουν κάθε αλλαγή αμέσως, με συνομιλία, σημειώσεις και ψηφοφορίες.',
  'demo.feature.journey.title': 'Ταξιδιωτικό ημερολόγιο Journey',
  'demo.feature.journey.body': 'Καταχωρίσεις, φωτογραφίες, διαθέσεις, υπέρ και κατά για κάθε μέρα στον δρόμο.',
  'demo.feature.atlas.title': 'Παγκόσμιος χάρτης Atlas',
  'demo.feature.atlas.body': 'Οι χώρες και οι περιοχές που έχεις επισκεφθεί, με τα ταξιδιωτικά σου στατιστικά.',
  'demo.feature.vacay.title': 'Σχεδιαστής αδειών Vacay',
  'demo.feature.vacay.body': 'Σχεδίασε τις άδειές σου γύρω από τις αργίες και δες πότε είναι όλοι ελεύθεροι.',
  'demo.feature.collections.title': 'Συλλογές',
  'demo.feature.collections.body':
    'Αποθήκευσε μέρη από διάφορα ταξίδια σε δικές σου λίστες και αντίγραψέ τα σε οποιοδήποτε πλάνο.',
  'demo.feature.offline.title': 'Λειτουργεί εκτός σύνδεσης',
  'demo.feature.offline.body': 'Εγκατάστησε το TREK ως εφαρμογή και κράτα πλάνα, χάρτες και λίστες χωρίς σύνδεση.',
  'demo.welcome.limitsTitle': 'Εκτός επίδειξης',
  'demo.limit.uploads': 'Μεταφόρτωση φωτογραφιών, εγγράφων και εξωφύλλων',
  'demo.limit.account': 'Αλλαγή λογαριασμού, κωδικού ή 2FA',
  'demo.limit.apiKeys': 'Δημιουργία κλειδιών API',
  'demo.limit.mcp': 'Σύνδεση πελατών MCP',
  'demo.limit.ai': 'Σύνδεση δικού σου μοντέλου ΤΝ',
  'demo.welcome.fullTitle': 'Η πλήρης έκδοση προσθέτει',
  'demo.full.sso': 'Σύνδεση με OIDC και SSO',
  'demo.full.backups': 'Αυτόματα αντίγραφα ασφαλείας',
  'demo.full.plugins': 'Πρόσθετα για νέες λειτουργίες',
  'demo.full.assistant': 'Τον βοηθό ΤΝ με το δικό σου μοντέλο',
  'demo.full.admin': 'Πίνακα διαχείρισης για χρήστες, πρόσθετα και δικαιώματα',
  'demo.welcome.repo': 'Πηγαίος κώδικας στο GitHub',
  'demo.welcome.start': 'Ξεκίνα την εξερεύνηση',
  'demo.welcome.credits': 'Πηγές φωτογραφιών',
  // The photo credits, the welcome dialog's second view (components/Demo/DemoCredits).
  'demo.credits.title': 'Πηγές φωτογραφιών',
  'demo.credits.intro':
    'Οι φωτογραφίες αυτής της επίδειξης προέρχονται από το Wikimedia Commons, η καθεμία με την άδεια που αναγράφεται δίπλα της. Η άδεια αυτή ισχύει μόνο για τη φωτογραφία, όχι για το TREK ή την υπόλοιπη επίδειξη.',
  'demo.credits.by': 'Φωτογραφία: {author}',
  'demo.credits.publicDomain': 'Κοινό κτήμα',
  'demo.credits.back': 'Πίσω',
  // The lock over a section the shared demo account may not change (components/Demo/DemoLock).
  'demo.lock.badge': 'Λειτουργία επίδειξης',
  'demo.lock.apiKeys': 'Στην επίδειξη δεν δημιουργούνται κλειδιά API.',
  'demo.lock.mcp': 'Στην επίδειξη δεν συνδέονται πελάτες MCP.',
  'demo.lock.ai': 'Στην επίδειξη δεν προστίθεται δική σου σύνδεση ΤΝ.',
  'demo.lock.aiTitle': 'Σύνδεσε δικό σου μοντέλο ΤΝ',
  'demo.lock.account': 'Ο κοινός λογαριασμός επίδειξης δεν αλλάζει.',
  'demo.lock.language': 'Η επίδειξη τρέχει πάντα στα αγγλικά.',
};

export default demo;
