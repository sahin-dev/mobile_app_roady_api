# README

## WebSocket API Documentation

---

### Overview

This WebSocket server handles real-time messaging, authentication, and user presence.  
Clients must authenticate before using most features.

---

### Events

#### 1. authenticate

**Client → Server**
```
{
  "event": "authenticate",
  "token": "<JWT_TOKEN>"
}
```

**Server → Client**

- On success:
```
{
  "event": "authentication_status",
  "data": { "message": "User authenticated" }
}
```
- On failure:  
  Connection is closed.

---

#### 2. message

**Client → Server**
```
{
  "event": "message",
  "receiverId": "<USER_ID>",
  "message": "<TEXT>",
  "images": ["<URL>", ...] // optional
}
```

**Server → Client**

- Sent to both sender and receiver:
```
{
  "event": "message",
  "data": { /* chat object */ }
}
```

---

---

#### 4. fetchChats

**Client → Server**
```
{
  "event": "fetchChats",
  "receiverId": "<USER_ID>"
}
```

**Server → Client**

- On success:
```
{
  "event": "fetchChats",
  "data": [ /* chat objects */ ]
}
```
- If no room found:
```
{ "event": "noRoomFound" }
```

---

#### 5. unReadMessages

**Client → Server**
```
{
  "event": "unReadMessages",
  "receiverId": "<USER_ID>"
}
```

**Server → Client**

- On success:
```
{
  "event": "unReadMessages",
  "data": {
    "messages": [ /* unread chat objects */ ],
    "count": <number>
  }
}
```
- If no room found:
```
{
  "event": "noUnreadMessages",
  "data": []
}
```

---

#### 6. messageList

**Client → Server**
```
{
  "event": "messageList"
}
```

**Server → Client**

- On success:
```
{
  "event": "messageList",
  "data": [
    {
      "user": { /* user info */ },
      "lastMessage": { /* last chat object */ }
    },
    ...
  ]
}
```
- On error:
```
{
  "event": "error",
  "message": "Failed to fetch users with last messages"
}
```

---

#### 7. userStatus (Broadcast)

**Server → All Clients**

- When a user connects/disconnects:
```
{
  "event": "userStatus",
  "data": {
    "userId": "<USER_ID>",
    "isOnline": true | false
  }
}
```

---

### Notes

- All messages are JSON.
- Unrecognized events are logged but ignored.
- On disconnect, user status is broadcasted.

---

**End of Documentation**