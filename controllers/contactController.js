const db = require('../config/db');

const identifyContact = async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Either email or phoneNumber is required" });
    }

    try {
        // Step 1: Find matching contacts
        const [contacts] = await db.execute(
            `SELECT * FROM contacts 
             WHERE (email = ? OR phoneNumber = ?) AND deletedAt IS NULL`,
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

        for (const contact of contacts) {
            if (contact.linkedId != null) {
                const [primaryContact1] = await db.execute(
                    `SELECT * FROM contacts 
                     WHERE id = ? AND deletedAt IS NULL`,
                    [contact.linkedId]
                );
                newlinkedContacts.push(primaryContact1[0]);
            } else {
                // Fetch all linked contacts
                const [linkedContacts] = await db.execute(
                    `SELECT * FROM contacts 
                     WHERE (linkedId = ? OR id = ?) AND deletedAt IS NULL`,
                    [primaryContact.id, primaryContact.id]
                );
                newlinkedContacts = [...linkedContacts];
            }
        }

        // Step 3: Update phoneNumber if it is different from the input
        if (primaryContact.phoneNumber !== phoneNumber && phoneNumber) {
            await db.execute(
                `UPDATE contacts 
                 SET phoneNumber = ?, updatedAt = NOW() 
                 WHERE id = ?`,
                [phoneNumber, primaryContact.id]
            );
        }

        // Step 4: Link all matching contacts to the primary contact
        for (const contact of contacts) {
            if (contact.id !== primaryContact.id && contact.linkPrecedence === 'primary') {
                await db.execute(
                    `UPDATE contacts 
                     SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = NOW() 
                     WHERE id = ?`,
                    [primaryContact.id, contact.id]
                );
            }
        }

        // Step 5: Consolidate data
        const consolidatedContact = {
            primaryContactId: primaryContact.id,
            emails: [...new Set(newlinkedContacts.map(contact => contact.email).filter(Boolean))],
            phoneNumbers: [...new Set(newlinkedContacts.map(contact => contact.phoneNumber).filter(Boolean))],
            secondaryContactIds: newlinkedContacts
                .filter(contact => contact.id !== primaryContact.id)
                .map(contact => contact.id),
        };

        return res.status(200).json({ contact: consolidatedContact });
    } catch (error) {
        console.error("Error identifying contact:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { identifyContact };
