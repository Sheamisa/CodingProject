require('dotenv').config();
const express = require('express');
const path = require('path');
const faunadb = require('faunadb');
const router = express.Router();

const client = new faunadb.Client({
  secret: process.env.FAUNADB_SECRET,
});

const q = faunadb.query;

function requireNoSession(req, res, next) {
  const sessionToken = req.cookies.Account_Session;

  if (sessionToken) {
    client.query(q.Get(q.Match(q.Index('sessions_by_token'), sessionToken)))
      .then(() => {
        // Session token is valid, redirect to another page
        res.redirect('/index');
      })
      .catch(() => {
        // Session token is invalid, continue to the next middleware
        next();
      });
  } else {
    // No session token found, continue to the next middleware
    next();
  }
}

function requireSession(req, res, next) {
  const sessionToken = req.cookies.Account_Session;

  if (sessionToken) {
    client.query(q.Get(q.Match(q.Index('sessions_by_token'), sessionToken)))
      .then((response) => {
        const userRef = response.data.user;
        // Fetch the user data using the user reference
        return client.query(q.Get(userRef));
      })
      .then((user) => {
        const blackliststatus = user.data.blacklistinfo.status;
        const currentDirectory = req.path;

        if (currentDirectory !== '/blacklist' && blackliststatus) {
          return res.redirect('/blacklist');
        }

        next(); // Session token is valid, continue to the next middleware
      })
      .catch(() => {
        // Session token is invalid, redirect to the login page
        res.redirect('/login');
      });
  } else {
    // No session token found, redirect to the login page
    res.redirect('/login');
  }
}

router.get('/admin', requireSession, async (req, res) => {
  try {

    
    const sessionToken = req.cookies.Account_Session;

    const user_ref_from_session = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('sessions_by_token'), sessionToken)),
        q.Lambda((x) => {
          return {
            ref: q.Select(['data', 'user'], q.Get(x)),
          };
        })
      )
    );

    const refid = user_ref_from_session.data[0].ref.value.id;

    const userData = await client.query(
      q.Map(
        q.Paginate(q.Ref(q.Collection('users'), refid)),
        q.Lambda((x) => ({
          user_id: q.Select(['ref', 'id'], q.Get(x)),
          membership: q.Select(['data', 'membership'], q.Get(x))
        }))
      )
    );

    const membership  = userData.data[0].membership;

    if(membership == "Admin" || membership == "Owner"){
      res.sendFile(path.join(__dirname, 'htdocs', 'admin.html'));
    }else{
      res.status(403).sendFile(path.join(__dirname, 'htdocs', '403.html'));;
    }
    
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

//Root Page

router.get('/', requireSession, (req, res) => {
  res.redirect('/index');
});

//Web Page
router.use(express.static('htdocs'));

router.get('/index', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'index.html'));
});

router.get('/login', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'login.html'));
});

router.get('/forgot', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'forgot.html'));
});

router.get('/register', requireNoSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'register.html'));
});

router.get('/reset-password', requireNoSession, async (req, res) => {
  const key = req.query.key;

  try {
    // Find the reset token in the password_reset_tokens collection
    await client.query(
      q.Get(q.Match(q.Index('password_reset_tokens_by_token'), key))
    );

    res.sendFile(path.join(__dirname, 'htdocs', 'reset.html'));

  } catch (error) {
    if (error instanceof faunadb.errors.NotFound) {
      return res.status(404).sendFile(path.join(__dirname, 'htdocs', '404.html'));
    }

    console.error('Error during password reset token lookup:', error);
    return res.status(500).sendFile(path.join(__dirname, 'htdocs', '500.html'));
  }
});

router.get('/addgame', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'addgame.html'));
});

router.get('/games', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'games.html'));
});

router.get('/download', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'download.html'));
});

router.get('/settings', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'settings.html'));
});

router.get('/configure', requireSession, async (req, res) => {
  const game_id = req.query.gameId;

  const user_ref_from_session = await client.query(
    q.Map(
      q.Paginate(q.Match(q.Index('sessions_by_token'), sessionToken)),
      q.Lambda((x) => {
        return {
          ref: q.Select(['data', 'user'], q.Get(x)),
        };
      })
    )
  );

  const refid = user_ref_from_session.data[0].ref.value.id;

  const userData = await client.query(
    q.Map(
      q.Paginate(q.Ref(q.Collection('users'), refid)),
      q.Lambda((x) => ({
        user_id: q.Select(['ref', 'id'], q.Get(x)),
        membership: q.Select(['data', 'membership'], q.Get(x))
      }))
    )
  );

  const user_id = userData.data[0].user_id;

  const gameExists = await client.query(q.Exists(q.Match(q.Index('users_games_by_game_id'), game_id)));

  if (!gameExists) {
    return res.status(404).sendFile(path.join(__dirname, 'htdocs', '404.html'));
  }

  const game = await client.query(q.Get(q.Match(q.Index('users_games_by_game_id'), game_id)));

  if (game.data.user_id !== user_id) {
    return res.status(404).sendFile(path.join(__dirname, 'htdocs', '404.html'));
  }

  if (!game_id) {
    return res.status(404).sendFile(path.join(__dirname, 'htdocs', '404.html'));
  }

  res.sendFile(path.join(__dirname, 'htdocs', 'configure.html'));
});

router.get('/cookies', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'cookies.html'));
});

router.get('/accounts', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'accounts.html'));
});

//Login Checker Page

router.get('/lc', requireSession, (req, res) => {
  res.sendFile(path.join(__dirname, 'htdocs', 'loginchecker.html'));
});

//Blacklist Page

router.get('/blacklist', requireSession, async (req, res) => {
  try {
    const sessionToken = req.cookies.Account_Session;
    
    const user_ref_from_session = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('sessions_by_token'), sessionToken)),
        q.Lambda((x) => {
          return {
            ref: q.Select(['data', 'user'], q.Get(x)),
          };
        })
      )
    );

    const refid = user_ref_from_session.data[0].ref.value.id;

    const userData = await client.query(
      q.Map(
        q.Paginate(q.Ref(q.Collection('users'), refid)),
        q.Lambda((x) => ({
          user_id: q.Select(['ref', 'id'], q.Get(x)),
          membership: q.Select(['data', 'membership'], q.Get(x))
        }))
      )
    );

    const membership = userData.data[0].membership;

    if(membership !== "Blacklist"){
      return res.status(404).sendFile(path.join(__dirname, 'htdocs', '404.html'));
    }

    res.sendFile(path.join(__dirname, 'htdocs', 'blacklist.html'));
  } catch (error) {
    console.error('Error retrieving blacklist data:', error);
    res.status(500).send('An error occurred while retrieving the blacklist data');
  }
});


module.exports = router;
