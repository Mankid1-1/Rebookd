export const automationTemplates = [
  {
    key: "reduce_no_shows",
    name: "Reduce No-Shows",
    category: "no_show",
    trigger: "appointment.no_show",
    steps: [
      { type: "delay", value: 600 },
      {
        type: "sms",
        message: "Hey {{first_name}}, we missed you today. Want to reschedule?"
      }
    ],
  },
  {
    key: "welcome_new_lead",
    name: "Welcome New Lead",
    category: "welcome",
    trigger: "lead.created",
    steps: [
      { type: "sms", message: "Hi {{name}}, thanks for reaching out! Reply with a time that works and we'll book you." }
    ],
  },
];
