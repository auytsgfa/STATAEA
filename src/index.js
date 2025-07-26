require('dotenv').config();
const {
  Client, GatewayIntentBits, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder,
  TextInputBuilder, TextInputStyle, Events, Partials
} = require('discord.js');

const {
  weaponList, bulletList,
  preturiArme, prafPerGlont
} = require('./data');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

const sesiuni = {};

client.once('ready', () => {
  console.log(`🤖 Bot online ca ${client.user.tag}`);
});

// 🧼 Comanda !curata
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!curata') {
    const channel = message.channel;

    if (!channel.permissionsFor(client.user).has('ManageMessages')) {
      return message.reply('❌ Nu am permisiunea să șterg mesajele în acest canal.');
    }

    try {
      let fetched;
      do {
        fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
      } while (fetched.size >= 2);

      await channel.send('🎉 **BINE AI VENIT LA CRAFTERUL COCO WILSON # MOSII+VLADIMIR MOSU PULA** 🎉');
    } catch (err) {
      console.error('Eroare la ștergere:', err);
      message.reply('❌ A apărut o eroare la ștergerea mesajelor.');
    }
  }

  // 📦 Comanda !inventar
  if (message.content === '!inventar') {
    const rowArme = new ActionRowBuilder();
    weaponList.forEach((arma) => {
      rowArme.addComponents(
        new ButtonBuilder()
          .setCustomId(`arma_${arma}`)
          .setLabel(arma)
          .setStyle(ButtonStyle.Primary)
      );
    });

    const rowGloante = new ActionRowBuilder();
    bulletList.forEach((glont) => {
      rowGloante.addComponents(
        new ButtonBuilder()
          .setCustomId(`glont_${glont}`)
          .setLabel(glont.replace('_glont', ''))
          .setStyle(ButtonStyle.Secondary)
      );
    });

    const embed = new EmbedBuilder()
      .setTitle('📦 Inventar Arme & Gloanțe')
      .setDescription('Apasă pe butoane pentru arme sau gloanțe și introdu cantitățile.\nCând ai terminat, scrie `!rezultat`.')
      .setColor(0x3498db);

    await message.channel.send({ embeds: [embed], components: [rowArme, rowGloante] });
  }

  // 📊 Comanda !rezultat
  if (message.content === '!rezultat') {
    const userId = message.author.id;
    const sesiune = sesiuni[userId];

    console.log('--- DEBUG: sesiune user la !rezultat ---');
    console.log(sesiune);

    if (!sesiune) {
      return message.reply('❌ Nu ai introdus nicio cantitate. Folosește mai întâi comanda `!inventar`.');
    }

    let armeText = `Tip        | Cant | Total\n-----------|------|--------\n`;
    let gloanteText = `Tip        | Cant | Praf/Gl | Total Praf\n-----------|------|---------|------------\n`;

    let totalArme = 0;
    let totalPraf = 0;

    // Arme
    for (const arma of weaponList) {
      const cant = sesiune.arme?.[arma] || 0;
      if (cant > 0) {
        const pret = preturiArme[arma];
        const total = pret * cant;
        armeText += `${arma.padEnd(12)}| ${String(cant).padEnd(4)} | ${total.toLocaleString()}$\n`;
        totalArme += total;
      }
    }

    // Gloanțe
    for (const glont of bulletList) {
      const cant = sesiune.gloante?.[glont] || 0;
      if (cant > 0) {
        const praf = prafPerGlont[glont] || 0;
        const totalPrafGlont = praf * cant;
        gloanteText += `${glont.replace('_glont', '').padEnd(12)}| ${String(cant).padEnd(4)} | ${praf.toFixed(2).padEnd(7)} | ${totalPrafGlont.toFixed(1).padEnd(10)}\n`;
        totalPraf += totalPrafGlont;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle(`📊 Rezultat pentru ${message.author.username}`)
      .addFields(
        { name: '🔫 Arme', value: armeText.trim() ? '```' + armeText + '```' : 'Nicio armă introdusă' },
        { name: '💥 Gloanțe', value: gloanteText.trim() ? '```' + gloanteText + '```' : 'Niciun glonț introdus' },
        { name: '📦 Total', value: `💰 Arme: **${totalArme.toLocaleString()}$**\n🧪 Praf total: **${totalPraf.toFixed(1)}**` }
      )
      .setColor(0x2ecc71);

    await message.channel.send({ embeds: [embed] });

    delete sesiuni[userId];
    console.log('--- DEBUG: sesiune user resetată ---');
    console.log(sesiuni[userId]);
  }
});

// Buton apăsat → formular
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const [tip, nume] = interaction.customId.split('_');
  const label = tip === 'glont' ? nume.replace('_glont', '') : nume;

  const modal = new ModalBuilder()
    .setCustomId(`input_${tip}_${nume}`)
    .setTitle(`📥 Cantitate pentru ${label}`);

  const input = new TextInputBuilder()
    .setCustomId('cantitate')
    .setLabel('Introdu numărul de bucăți')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 5')
    .setRequired(true);

  const row = new ActionRowBuilder().addComponents(input);
  modal.addComponents(row);

  await interaction.showModal(modal);
});

// Modal completat
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isModalSubmit()) return;

  const [_, tip, nume] = interaction.customId.split('_');
  const userId = interaction.user.id;
  const cantitate = parseInt(interaction.fields.getTextInputValue('cantitate'));

  if (isNaN(cantitate) || cantitate < 0) {
    return interaction.reply({ content: '❌ Cantitate invalidă!', ephemeral: true });
  }

  if (!sesiuni[userId]) sesiuni[userId] = { arme: {}, gloante: {} };

  if (tip === 'arma') {
    sesiuni[userId].arme[nume] = cantitate;
  } else if (tip === 'glont') {
    sesiuni[userId].gloante[nume] = cantitate;
  }

  console.log(`--- DEBUG: sesiuni[${userId}] după setare cantitate ---`);
  console.log(sesiuni[userId]);

  await interaction.reply({
    content: `✅ Ai introdus **${cantitate}x ${tip === 'arma' ? nume : nume.replace('_glont', '')}**.`,
    ephemeral: true,
  });
});

client.login(process.env.TOKEN);
