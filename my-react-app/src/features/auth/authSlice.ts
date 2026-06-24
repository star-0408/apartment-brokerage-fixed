import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import axios from "axios";

const API = import.meta.env.VITE_LOGIC_SERVER ?? "https://logic-server.onrender.com";

interface AuthPayload {
  userId: string;
  userName: string;
  email?: string | null;
  phone?: string | null;
  token?: string;
  profileImageBase64?: string | null;
}

interface AuthState {
  userId: string;
  userName: string;
  email: string | null;
  phone: string | null;
  token: string;
  isAuthenticated: boolean;
  profileImageBase64: string;
}

const initialState: AuthState = {
  userId: "",
  userName: "",
  email: null,
  phone: null,
  token: "",
  isAuthenticated: false,
  profileImageBase64: "",
};

export const loginUser = createAsyncThunk<
  AuthPayload,
  { userName: string; password: string }
>("auth/loginUser", async (data, thunkAPI) => {
  try {
    const res = await axios.post(`${API}/auth/login`, data);
    return {
      userId: res.data.userId,
      userName: res.data.userName,
      email: res.data.email ?? null,
      phone: res.data.phone ?? null,
      token: res.data.token,
      profileImageBase64: res.data.profileImageBase64 ?? null,
    };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.response?.data);
  }
});

export const registerUser = createAsyncThunk<
  AuthPayload,
  { userName: string; password: string; email?: string | null; phone?: string | null }
>("auth/registerUser", async (data, thunkAPI) => {
  try {
    const res = await axios.post(`${API}/auth/register`, data);
    return {
      userId: res.data.userId,
      userName: res.data.userName,
      email: res.data.email ?? null,
      phone: res.data.phone ?? null,
      token: res.data.token ?? null,
      profileImageBase64: res.data.profileImageBase64 ?? null,
    };
  } catch (err: any) {
    return thunkAPI.rejectWithValue(err.response?.data);
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // ✅ חדש: עדכון token לאחר refresh
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
    logout(state) {
      state.userId = "";
      state.userName = "";
      state.email = null;
      state.phone = null;
      state.token = "";
      state.isAuthenticated = false;
      state.profileImageBase64 = "";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.fulfilled, (state, action) => {
        state.userId = action.payload.userId;
        state.userName = action.payload.userName;
        state.email = action.payload.email ?? null;
        state.phone = action.payload.phone ?? null;
        state.token = action.payload.token ?? "";
        state.isAuthenticated = true;
        state.profileImageBase64 = action.payload.profileImageBase64 ?? "";
      })
      .addCase(loginUser.rejected, (state) => {
        state.isAuthenticated = false;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.userId = action.payload.userId;
        state.userName = action.payload.userName;
        state.email = action.payload.email ?? null;
        state.phone = action.payload.phone ?? null;
        state.token = action.payload.token ?? "";
        state.isAuthenticated = !!action.payload.token;
        state.profileImageBase64 = action.payload.profileImageBase64 ?? "";
      });
  },
});

export const { setToken, logout } = authSlice.actions;
export default authSlice.reducer;
