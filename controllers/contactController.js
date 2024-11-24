const db = require('../config/db');

const identifyContact = async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Either email or phoneNumber is required" });
    }

    try {
        // Step 1: Find matching contacts
        const [contacts] = await db.execute(
            'SELECT * FROM contacts WHERE (email = ? OR phoneNumber = ?) AND deletedAt IS NULL',
            [email, phoneNumber]
        );

        let newlinkedContacts = [...contacts];

        if (contacts.length === 0) {
            // No matches found, create a new primary contact
            const [insertResult] = await db.execute(
                `INSERT INTO contacts (phoneNumber, email, linkPrecedence, createdAt, updatedAt) 
                 VALUES (?, ?, 'primary', NOW(), NOW())`,
                [phoneNumber, email]
            );
            const newContactId = insertResult.insertId;

            return res.status(200).json({
                contact: {
                    primaryContactId: newContactId,
                    emails: email ? [email] : [],
                    phoneNumbers: phoneNumber ? [phoneNumber] : [],
                    secondaryContactIds: [],
                },
            });
        }

        // Step 2: Determine the primary contact
        const primaryContact = contacts.find(c => c.linkPrecedence === 'primary')
            || contacts.reduce((oldest, current) =>
                (new Date(oldest.createdAt) < new Date(current.createdAt) ? oldest : current)
            );

        // Step 3: Fetch all linked contacts
        for (const contact of contacts) {
            if (contact.linkedId != null) {
                // Fetch linked contact details
                const [linkedContact] = await db.execute(
                    'SELECT * FROM contacts WHERE id = ? AND deletedAt IS NULL',
                    [contact.linkedId]
                );
                if (linkedContact.length > 0) {
                    newlinkedContacts.push(linkedContact[0]);
                }
            } else {
                // Fetch all contacts linked to the primary contact
                const [linkedContacts] = await db.execute(
                    'SELECT * FROM contacts WHERE (linkedId = ? OR id = ?) AND deletedAt IS NULL',
                    [primaryContact.id, primaryContact.id]
                );
                newlinkedContacts = [...newlinkedContacts, ...linkedContacts];
            }
        }

        // Step 4: Link all matching contacts to the primary contact
        const primarysLinkedIds = []
        for (const contact of contacts) {
            if (contact.id !== primaryContact.id && contact.linkPrecedence === 'primary') {
                primarysLinkedIds.push([contact.email,contact.phoneNumber])
                await db.execute(
                    `UPDATE contacts 
                    SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = NOW() 
                    WHERE id = ?`,
                    [primaryContact.id, contact.id]
                );

            }

        }
        // console.log(primarysLinkedIds)
        // Step 5: Consolidate data
        // Sort the newlinkedContacts array by createdAt in ascending order (oldest first)
        newlinkedContacts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const consolidatedContact = {
            primaryContactId: primaryContact.id,
            emails: [...new Set(newlinkedContacts.map(contact => contact.email))],
            phoneNumbers: [...new Set(newlinkedContacts.map(contact => contact.phoneNumber).filter(Boolean))],
            secondaryContactIds: [...new Set(newlinkedContacts
                .filter(contact => contact.id !== primaryContact.id)
                .map(contact => contact.id))],
        };

        return res.status(200).json({ contact: consolidatedContact });
    } catch (error) {
        console.error("Error identifying contact:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { identifyContact };
