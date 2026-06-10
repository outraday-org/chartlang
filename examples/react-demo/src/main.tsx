// Copyright (c) 2026 Invinite. Licensed under the MIT License.
// See the LICENSE file in the repo root for full license text.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
    throw new Error("react-demo: #root element not found in index.html");
}
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
