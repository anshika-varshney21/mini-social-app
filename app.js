const express = require('express');
const app = express();
const userModel = require('./models/user');
const postModel = require('./models/post');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const bcrypt = require('bcrypt');

app.get('/', (req, res) => {
  res.render('index');
});

app.post('/register', async (req, res) => {
    let { username, name, age, email, password } = req.body;
    let user = await userModel.findOne({email})
    if(user) return res.status(400).send('User already exists');
    bcrypt.genSalt(10,  (err, salt) => {
        bcrypt.hash(password, salt,  async(err, hash) => {
            let user = await userModel.create({
                username,
                name,
                age,
                email,
                password: hash
            
            });
            let token = jwt.sign({ email:email, userid:user._id },"shhhh");
            res.cookie('token', token);
            res.send('User registered successfully');
        })
    })
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.get('/profile', isLoggedIn,  async (req, res) => {
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    res.render("profile",{user});
});
app.post('/posts', isLoggedIn, async (req, res) => {
  let user = await userModel.findOne({ email: req.user.email });
  let { content } = req.body;

  let post = await postModel.create({
    user: user._id,
    content
  });

  user.posts.push(post._id);
  await user.save();

  res.redirect('/profile');
});
// Edit post - show edit form
app.get('/posts/:id/edit', isLoggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  if (!post) return res.status(404).send('Post not found');
  // Only allow editing own posts
  if (post.user.toString() !== req.user.userid) return res.status(403).send('Unauthorized');
  res.render('editPost', { post });
});

// Edit post - handle update
app.post('/posts/:id/edit', isLoggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  if (!post) return res.status(404).send('Post not found');
  if (post.user.toString() !== req.user.userid) return res.status(403).send('Unauthorized');
  post.content = req.body.content;
  await post.save();
  res.redirect('/profile');
});

// Delete post
app.post('/posts/:id', isLoggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  if (!post) return res.status(404).send('Post not found');
  if (post.user.toString() !== req.user.userid) return res.status(403).send('Unauthorized');
  await postModel.deleteOne({ _id: req.params.id });
  // Remove post from user's posts array
  await userModel.updateOne(
    { _id: req.user.userid },
    { $pull: { posts: req.params.id } }
  );
  res.redirect('/profile');
});


app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user) return res.status(400).send('User not found');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).send('Invalid credentials');

    const token = jwt.sign({ email, userid: user._id }, "shhhh");
    res.cookie('token', token);
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});


function isLoggedIn(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
        return res.redirect('/login');
    }

    try {
        const data = jwt.verify(token, "shhhh");
        req.user = data;
        next();
    } catch (err) {
        console.error("Invalid Token:", err.message);
        res.redirect('/login');
    }
}

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});