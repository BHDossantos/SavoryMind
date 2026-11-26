"""SavoryMind's business agent, ported from Jennifer (src/company/businessAgents.ts).
Generated; edit in Jennifer and re-port.
"""

BUSINESS_AGENTS = [
    {
        "companyId": "restaurant",
        "name": "SavoryMind agent",
        "mission": "Get independent restaurant owners and managers into conversations, demos and pilots.",
        "routine": {
            "name": "savoryMind",
            "does": "Daily 30-day campaign task and up to five new qualified restaurant contacts."
        },
        "guardrails": [
            "Mark hypotheses as hypotheses; no invented customers, metrics or testimonials.",
            "No mobile launch, features or results unless the approved brain confirms them."
        ],
        "measures": [
            "qualified replies",
            "conversations booked",
            "demos held",
            "pilots started"
        ],
        "tasks": [
            {
                "id": "prospects",
                "name": "Qualify restaurant contacts",
                "department": "sales",
                "cadence": "daily",
                "does": "Qualify independent restaurant owners and managers. The daily Claude routine finds and drafts; this task qualifies what it logged, drops duplicates and anyone on the do-not-contact list, and proposes the next step for each.",
                "inputs": [
                    "icp",
                    "offer",
                    "CRM accounts"
                ],
                "outputs": [
                    "email and LinkedIn drafts",
                    "CRM tasks"
                ],
                "approval": "Drafts and CRM changes wait for Bruno."
            },
            {
                "id": "demos",
                "name": "Demos and pilots",
                "department": "deals",
                "cadence": "daily",
                "does": "Follow up on conversations: propose demo times, a short workflow call or a pilot, and flag what would make the restaurant say yes.",
                "inputs": [
                    "offer",
                    "pricing",
                    "CRM opportunities"
                ],
                "outputs": [
                    "follow-up drafts",
                    "demo script"
                ],
                "approval": "Calendar holds and messages wait for Bruno."
            },
            {
                "id": "content",
                "name": "Restaurant content week",
                "department": "marketing",
                "cadence": "weekly",
                "does": "Plan the week of posts and a 30-second demo script from the approved offer.",
                "inputs": [
                    "offer",
                    "brand",
                    "claims"
                ],
                "outputs": [
                    "post drafts",
                    "demo script"
                ],
                "approval": "Each post waits for Bruno."
            }
        ]
    }
]

BUSINESS_AGENT = BUSINESS_AGENTS[0]
