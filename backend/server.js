const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const JIRA_URL = process.env.JIRA_URL;
const JIRA_AUTH = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_TOKEN}`).toString('base64');

// Read Issues
app.get('/api/issues', async (req, res) => {
  try {
    const jql = req.query.jql || 'project = YOUR_PROJECT';
    const response = await axios.get(`${JIRA_URL}/rest/api/3/search`, {
      headers: {
        Authorization: `Basic ${JIRA_AUTH}`,
        Accept: 'application/json'
      },
      params: {
        jql,
        fields: 'summary,created,status,resolutiondate'
      }
    });

    const issues = response.data.issues.map(issue => ({
      id: issue.id,
      title: issue.fields.summary,
      created: issue.fields.created,
      status: issue.fields.status.name.toLowerCase(),
      leadTime: issue.fields.resolutiondate
        ? (new Date(issue.fields.resolutiondate) - new Date(issue.fields.created)) / (1000 * 60 * 60 * 24)
        : null
    }));

    res.json(issues);
  } catch (error) {
    console.error('Error fetching issues from JIRA:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch issues' });
  }
});

// Create Issue
app.post('/api/issues', async (req, res) => {
  try {
    const { projectKey, summary, description, issueType } = req.body;
    const issueData = {
      fields: {
        project: { key: projectKey },
        summary,
        description,
        issuetype: { name: issueType || 'Task' }
      }
    };

    const response = await axios.post(`${JIRA_URL}/rest/api/3/issue`, issueData, {
      headers: {
        Authorization: `Basic ${JIRA_AUTH}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    res.status(201).json({ id: response.data.id, key: response.data.key });
  } catch (error) {
    console.error('Error creating issue:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to create issue' });
  }
});

// Update Issue
app.put('/api/issues/:id', async (req, res) => {
  try {
    const issueId = req.params.id;
    const updateData = { fields: req.body };

    await axios.put(`${JIRA_URL}/rest/api/3/issue/${issueId}`, updateData, {
      headers: {
        Authorization: `Basic ${JIRA_AUTH}`,
        Accept: 'application/json',
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({ message: 'Issue updated successfully' });
  } catch (error) {
    console.error('Error updating issue:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to update issue' });
  }
});

// Delete Issue
app.delete('/api/issues/:id', async (req, res) => {
  try {
    const issueId = req.params.id;
    await axios.delete(`${JIRA_URL}/rest/api/3/issue/${issueId}`, {
      headers: {
        Authorization: `Basic ${JIRA_AUTH}`
      }
    });

    res.status(200).json({ message: 'Issue deleted successfully' });
  } catch (error) {
    console.error('Error deleting issue:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to delete issue' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
