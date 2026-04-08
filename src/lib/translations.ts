export type Lang = "nl" | "en";

export const t = {
  // Login page
  login_title: { nl: "VBSK Amsterdam", en: "VBSK Amsterdam" },
  login_subtitle: { nl: "Urenregistratie", en: "Time Registration" },
  login_select_trainer: { nl: "Selecteer je naam", en: "Select your name" },
  login_pin: { nl: "Pincode", en: "Pin code" },
  login_button: { nl: "Inloggen", en: "Log in" },
  login_error: { nl: "Ongeldige pincode", en: "Invalid pin code" },

  // Trainer page - header
  greeting: { nl: "Hoi", en: "Hi" },
  subtitle: { nl: "VBSK Urenregistratie", en: "VBSK Time Registration" },
  logout: { nl: "Uitloggen", en: "Log out" },

  // Calendar
  legend_submitted: { nl: "Uren ingediend", en: "Hours submitted" },
  legend_workday: { nl: "Werkdag (rooster)", en: "Work day (schedule)" },

  // Day detail
  schedule_label: { nl: "Rooster", en: "Schedule" },
  your_class: { nl: "Jouw les", en: "Your class" },
  submitted_label: { nl: "Ingediend", en: "Submitted" },
  add_hours: { nl: "+ Uren toevoegen voor deze dag", en: "+ Add hours for this day" },
  regulier: { nl: "Regulier", en: "Regular" },
  inval: { nl: "Inval", en: "Substitute" },
  inval_voor: { nl: "Inval voor", en: "Substitute for" },

  // Status
  ingediend: { nl: "ingediend", en: "submitted" },
  goedgekeurd: { nl: "goedgekeurd", en: "approved" },
  afgewezen: { nl: "afgewezen", en: "rejected" },
  reason: { nl: "Reden", en: "Reason" },

  // Hour form
  form_title: { nl: "Uren invoeren", en: "Enter hours" },
  form_date: { nl: "Datum", en: "Date" },
  form_start: { nl: "Begintijd", en: "Start time" },
  form_end: { nl: "Eindtijd", en: "End time" },
  form_type: { nl: "Type", en: "Type" },
  form_type_regulier: { nl: "Regulier", en: "Regular" },
  form_type_inval: { nl: "Inval", en: "Substitute" },
  form_inval_for: { nl: "Inval voor", en: "Substitute for" },
  form_select_trainer: { nl: "Selecteer trainer...", en: "Select trainer..." },
  form_remark: { nl: "Opmerking (optioneel)", en: "Remark (optional)" },
  form_submit: { nl: "Indienen", en: "Submit" },
  form_saving: { nl: "Opslaan...", en: "Saving..." },
  form_cancel: { nl: "Annuleer", en: "Cancel" },

  // Expenses
  expenses_title: { nl: "Onkosten", en: "Expenses" },
  expenses_add: { nl: "+ Toevoegen", en: "+ Add" },
  expenses_empty: { nl: "Nog geen onkosten ingediend", en: "No expenses submitted yet" },
  expense_date: { nl: "Datum", en: "Date" },
  expense_amount: { nl: "Bedrag", en: "Amount" },
  expense_category: { nl: "Categorie", en: "Category" },
  expense_description: { nl: "Omschrijving", en: "Description" },
  expense_placeholder: { nl: "bijv. Reiskosten heen en terug", en: "e.g. Travel costs round trip" },

  // Categories
  cat_benzine: { nl: "Benzine", en: "Fuel" },
  cat_materiaal: { nl: "Materiaal", en: "Equipment" },
  cat_parkeren: { nl: "Parkeren", en: "Parking" },
  cat_overig: { nl: "Overig", en: "Other" },

  // Confirm dialogs
  confirm_delete_hours: { nl: "Weet je zeker dat je deze uren wilt verwijderen?", en: "Are you sure you want to delete these hours?" },
  confirm_delete_expense: { nl: "Weet je zeker dat je deze onkosten wilt verwijderen?", en: "Are you sure you want to delete this expense?" },
} as const;

export type TranslationKey = keyof typeof t;

export function tr(key: TranslationKey, lang: Lang): string {
  return t[key][lang];
}
