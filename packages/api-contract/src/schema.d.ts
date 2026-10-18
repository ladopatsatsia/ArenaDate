export interface paths {
    "/account/delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "text/html": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["DeleteAccountRequest"];
                    "application/json": components["schemas"]["DeleteAccountRequest"];
                    "text/json": components["schemas"]["DeleteAccountRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/confirm-deletion": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ConfirmPublicDeletionRequest"];
                    "application/json": components["schemas"]["ConfirmPublicDeletionRequest"];
                    "text/json": components["schemas"]["ConfirmPublicDeletionRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/delete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["DeleteAccountRequest"];
                    "application/json": components["schemas"]["DeleteAccountRequest"];
                    "text/json": components["schemas"]["DeleteAccountRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/deletion-status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DeletionStatusResponse"];
                        "text/json": components["schemas"]["DeletionStatusResponse"];
                        "text/plain": components["schemas"]["DeletionStatusResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/discoverability-pause": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["DiscoverabilityPauseRequest"];
                    "application/json": components["schemas"]["DiscoverabilityPauseRequest"];
                    "text/json": components["schemas"]["DiscoverabilityPauseRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/account/public-deletion-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["PublicDeletionRequest"];
                    "application/json": components["schemas"]["PublicDeletionRequest"];
                    "text/json": components["schemas"]["PublicDeletionRequest"];
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AcceptedResponse"];
                        "text/json": components["schemas"]["AcceptedResponse"];
                        "text/plain": components["schemas"]["AcceptedResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/forgot-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["EmailRequest"];
                    "application/json": components["schemas"]["EmailRequest"];
                    "text/json": components["schemas"]["EmailRequest"];
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AcceptedResponse"];
                        "text/json": components["schemas"]["AcceptedResponse"];
                        "text/plain": components["schemas"]["AcceptedResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["LoginRequest"];
                    "application/json": components["schemas"]["LoginRequest"];
                    "text/json": components["schemas"]["LoginRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TokenResponse"];
                        "text/json": components["schemas"]["TokenResponse"];
                        "text/plain": components["schemas"]["TokenResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["LogoutRequest"];
                    "application/json": components["schemas"]["LogoutRequest"];
                    "text/json": components["schemas"]["LogoutRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/logout-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AccountResponse"];
                        "text/json": components["schemas"]["AccountResponse"];
                        "text/plain": components["schemas"]["AccountResponse"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/otp/send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["OtpSendRequest"];
                    "application/json": components["schemas"]["OtpSendRequest"];
                    "text/json": components["schemas"]["OtpSendRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OtpSendResponse"];
                        "text/json": components["schemas"]["OtpSendResponse"];
                        "text/plain": components["schemas"]["OtpSendResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/otp/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["OtpVerifyRequest"];
                    "application/json": components["schemas"]["OtpVerifyRequest"];
                    "text/json": components["schemas"]["OtpVerifyRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OtpVerifyResponse"];
                        "text/json": components["schemas"]["OtpVerifyResponse"];
                        "text/plain": components["schemas"]["OtpVerifyResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/refresh": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["RefreshRequest"];
                    "application/json": components["schemas"]["RefreshRequest"];
                    "text/json": components["schemas"]["RefreshRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TokenResponse"];
                        "text/json": components["schemas"]["TokenResponse"];
                        "text/plain": components["schemas"]["TokenResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/register": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["RegisterRequest"];
                    "application/json": components["schemas"]["RegisterRequest"];
                    "text/json": components["schemas"]["RegisterRequest"];
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AcceptedResponse"];
                        "text/json": components["schemas"]["AcceptedResponse"];
                        "text/plain": components["schemas"]["AcceptedResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/reset-password": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ResetRequest"];
                    "application/json": components["schemas"]["ResetRequest"];
                    "text/json": components["schemas"]["ResetRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/telegram": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["TelegramAuthRequest"];
                    "application/json": components["schemas"]["TelegramAuthRequest"];
                    "text/json": components["schemas"]["TelegramAuthRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OtpVerifyResponse"];
                        "text/json": components["schemas"]["OtpVerifyResponse"];
                        "text/plain": components["schemas"]["OtpVerifyResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/verification-email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["EmailRequest"];
                    "application/json": components["schemas"]["EmailRequest"];
                    "text/json": components["schemas"]["EmailRequest"];
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AcceptedResponse"];
                        "text/json": components["schemas"]["AcceptedResponse"];
                        "text/plain": components["schemas"]["AcceptedResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/auth/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["VerifyRequest"];
                    "application/json": components["schemas"]["VerifyRequest"];
                    "text/json": components["schemas"]["VerifyRequest"];
                };
            };
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversation}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    before?: number | string;
                    after?: number | string;
                };
                header?: never;
                path: {
                    conversation: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HistoryPage"];
                        "text/json": components["schemas"]["HistoryPage"];
                        "text/plain": components["schemas"]["HistoryPage"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    conversation: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SendMessage"];
                    "application/json": components["schemas"]["SendMessage"];
                    "text/json": components["schemas"]["SendMessage"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MessageDto"];
                        "text/json": components["schemas"]["MessageDto"];
                        "text/plain": components["schemas"]["MessageDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/conversations/{conversation}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    conversation: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ReadMessage"];
                    "application/json": components["schemas"]["ReadMessage"];
                    "text/json": components["schemas"]["ReadMessage"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReadDto"];
                        "text/json": components["schemas"]["ReadDto"];
                        "text/plain": components["schemas"]["ReadDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/discovery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoveryPage"];
                        "text/json": components["schemas"]["DiscoveryPage"];
                        "text/plain": components["schemas"]["DiscoveryPage"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/discovery/location": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["LocationRequest"];
                    "application/json": components["schemas"]["LocationRequest"];
                    "text/json": components["schemas"]["LocationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoverySettings"];
                        "text/json": components["schemas"]["DiscoverySettings"];
                        "text/plain": components["schemas"]["DiscoverySettings"];
                    };
                };
            };
        };
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoverySettings"];
                        "text/json": components["schemas"]["DiscoverySettings"];
                        "text/plain": components["schemas"]["DiscoverySettings"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/discovery/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoverySettings"];
                        "text/json": components["schemas"]["DiscoverySettings"];
                        "text/plain": components["schemas"]["DiscoverySettings"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SettingsRequest"];
                    "application/json": components["schemas"]["SettingsRequest"];
                    "text/json": components["schemas"]["SettingsRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoverySettings"];
                        "text/json": components["schemas"]["DiscoverySettings"];
                        "text/plain": components["schemas"]["DiscoverySettings"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/discovery/{target}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    target: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiscoveryCard"];
                        "text/json": components["schemas"]["DiscoveryCard"];
                        "text/plain": components["schemas"]["DiscoveryCard"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/ai-consent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserAiConsentResponse"];
                        "text/json": components["schemas"]["UserAiConsentResponse"];
                        "text/plain": components["schemas"]["UserAiConsentResponse"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["UpdateAiConsentRequest"];
                    "application/json": components["schemas"]["UpdateAiConsentRequest"];
                    "text/json": components["schemas"]["UpdateAiConsentRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserAiConsentResponse"];
                        "text/json": components["schemas"]["UserAiConsentResponse"];
                        "text/plain": components["schemas"]["UserAiConsentResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomDetail"];
                        "text/json": components["schemas"]["GameRoomDetail"];
                        "text/plain": components["schemas"]["GameRoomDetail"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/direct-request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SendDirectMatchRequestInput"];
                    "application/json": components["schemas"]["SendDirectMatchRequestInput"];
                    "text/json": components["schemas"]["SendDirectMatchRequestInput"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SendDirectMatchRequestResult"];
                        "text/json": components["schemas"]["SendDirectMatchRequestResult"];
                        "text/plain": components["schemas"]["SendDirectMatchRequestResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/direct-request/{requestId}/respond": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    requestId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["RespondDirectMatchRequestInput"];
                    "application/json": components["schemas"]["RespondDirectMatchRequestInput"];
                    "text/json": components["schemas"]["RespondDirectMatchRequestInput"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RespondDirectMatchRequestResult"];
                        "text/json": components["schemas"]["RespondDirectMatchRequestResult"];
                        "text/plain": components["schemas"]["RespondDirectMatchRequestResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/gifts/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GiftCatalogItemDto"][];
                        "text/json": components["schemas"]["GiftCatalogItemDto"][];
                        "text/plain": components["schemas"]["GiftCatalogItemDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/gifts/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserGiftsDto"];
                        "text/json": components["schemas"]["UserGiftsDto"];
                        "text/plain": components["schemas"]["UserGiftsDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/gifts/send": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SendGiftRequest"];
                    "application/json": components["schemas"]["SendGiftRequest"];
                    "text/json": components["schemas"]["SendGiftRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SendGiftResult"];
                        "text/json": components["schemas"]["SendGiftResult"];
                        "text/plain": components["schemas"]["SendGiftResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/profiles/views": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameProfileViewNoticeDto"][];
                        "text/json": components["schemas"]["GameProfileViewNoticeDto"][];
                        "text/plain": components["schemas"]["GameProfileViewNoticeDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/profiles/views/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/profiles/{targetUserId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    targetUserId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameProfileDto"];
                        "text/json": components["schemas"]["GameProfileDto"];
                        "text/plain": components["schemas"]["GameProfileDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/profiles/{targetUserId}/unlock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    targetUserId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["UnlockProfileRequest"];
                    "application/json": components["schemas"]["UnlockProfileRequest"];
                    "text/json": components["schemas"]["UnlockProfileRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UnlockProfileResult"];
                        "text/json": components["schemas"]["UnlockProfileResult"];
                        "text/plain": components["schemas"]["UnlockProfileResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["JoinQueueRequest"];
                    "application/json": components["schemas"]["JoinQueueRequest"];
                    "text/json": components["schemas"]["JoinQueueRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomDetail"];
                        "text/json": components["schemas"]["GameRoomDetail"];
                        "text/plain": components["schemas"]["GameRoomDetail"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomSummary"][];
                        "text/json": components["schemas"]["GameRoomSummary"][];
                        "text/plain": components["schemas"]["GameRoomSummary"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["CreateRoomRequest"];
                    "application/json": components["schemas"]["CreateRoomRequest"];
                    "text/json": components["schemas"]["CreateRoomRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomDetail"];
                        "text/json": components["schemas"]["GameRoomDetail"];
                        "text/plain": components["schemas"]["GameRoomDetail"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomDetail"];
                        "text/json": components["schemas"]["GameRoomDetail"];
                        "text/plain": components["schemas"]["GameRoomDetail"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/dev-fixtures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["DevFixtureSeedRequest"];
                    "application/json": components["schemas"]["DevFixtureSeedRequest"];
                    "text/json": components["schemas"]["DevFixtureSeedRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/heartbeat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HeartbeatResult"];
                        "text/json": components["schemas"]["HeartbeatResult"];
                        "text/plain": components["schemas"]["HeartbeatResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/join": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JoinRoomResult"];
                        "text/json": components["schemas"]["JoinRoomResult"];
                        "text/plain": components["schemas"]["JoinRoomResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/leave": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LeaveRoomResult"];
                        "text/json": components["schemas"]["LeaveRoomResult"];
                        "text/plain": components["schemas"]["LeaveRoomResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomMessageDto"][];
                        "text/json": components["schemas"]["GameRoomMessageDto"][];
                        "text/plain": components["schemas"]["GameRoomMessageDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SendRoomMessageRequest"];
                    "application/json": components["schemas"]["SendRoomMessageRequest"];
                    "text/json": components["schemas"]["SendRoomMessageRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomMessageDto"];
                        "text/json": components["schemas"]["GameRoomMessageDto"];
                        "text/plain": components["schemas"]["GameRoomMessageDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/post-game-kiss": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["PostGameKissRequest"];
                    "application/json": components["schemas"]["PostGameKissRequest"];
                    "text/json": components["schemas"]["PostGameKissRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PostGameKissResult"];
                        "text/json": components["schemas"]["PostGameKissResult"];
                        "text/plain": components["schemas"]["PostGameKissResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/reconnect": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReconnectRoomResult"];
                        "text/json": components["schemas"]["ReconnectRoomResult"];
                        "text/plain": components["schemas"]["ReconnectRoomResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/rounds/{roundId}/kiss": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    roundId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SendKissRequest"];
                    "application/json": components["schemas"]["SendKissRequest"];
                    "text/json": components["schemas"]["SendKissRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SendKissResult"];
                        "text/json": components["schemas"]["SendKissResult"];
                        "text/plain": components["schemas"]["SendKissResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/rounds/{roundId}/kiss/skip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    roundId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SkipKissRequest"];
                    "application/json": components["schemas"]["SkipKissRequest"];
                    "text/json": components["schemas"]["SkipKissRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/rounds/{roundId}/questions/{questionIndex}/answer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    roundId: string;
                    questionIndex: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["AnswerQuestionRequest"];
                    "application/json": components["schemas"]["AnswerQuestionRequest"];
                    "text/json": components["schemas"]["AnswerQuestionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AnswerQuestionResult"];
                        "text/json": components["schemas"]["AnswerQuestionResult"];
                        "text/plain": components["schemas"]["AnswerQuestionResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/rounds/{roundId}/questions/{questionIndex}/skip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    roundId: string;
                    questionIndex: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SkipQuestionRequest"];
                    "application/json": components["schemas"]["SkipQuestionRequest"];
                    "text/json": components["schemas"]["SkipQuestionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AnswerQuestionResult"];
                        "text/json": components["schemas"]["AnswerQuestionResult"];
                        "text/plain": components["schemas"]["AnswerQuestionResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/rounds/{roundId}/target": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    roundId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SelectTargetRequest"];
                    "application/json": components["schemas"]["SelectTargetRequest"];
                    "text/json": components["schemas"]["SelectTargetRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelectTargetResult"];
                        "text/json": components["schemas"]["SelectTargetResult"];
                        "text/plain": components["schemas"]["SelectTargetResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/rounds/{roundId}/target/skip": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    roundId: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/*+json": null | components["schemas"]["SkipTargetRequest"];
                    "application/json": null | components["schemas"]["SkipTargetRequest"];
                    "text/json": null | components["schemas"]["SkipTargetRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/snapshot": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameRoomSnapshot"];
                        "text/json": components["schemas"]["GameRoomSnapshot"];
                        "text/plain": components["schemas"]["GameRoomSnapshot"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/rooms/{id}/spin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: {
                    autoPickTarget?: boolean;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/*+json": null | components["schemas"]["SpinRequest"];
                    "application/json": null | components["schemas"]["SpinRequest"];
                    "text/json": null | components["schemas"]["SpinRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SpinResult"];
                        "text/json": components["schemas"]["SpinResult"];
                        "text/plain": components["schemas"]["SpinResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/store/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StoreProductDto"][];
                        "text/json": components["schemas"]["StoreProductDto"][];
                        "text/plain": components["schemas"]["StoreProductDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/store/purchase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["StorePurchaseRequest"];
                    "application/json": components["schemas"]["StorePurchaseRequest"];
                    "text/json": components["schemas"]["StorePurchaseRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StorePurchaseResult"];
                        "text/json": components["schemas"]["StorePurchaseResult"];
                        "text/plain": components["schemas"]["StorePurchaseResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/store/refund": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["StoreRefundRequest"];
                    "application/json": components["schemas"]["StoreRefundRequest"];
                    "text/json": components["schemas"]["StoreRefundRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["StoreRefundResult"];
                        "text/json": components["schemas"]["StoreRefundResult"];
                        "text/plain": components["schemas"]["StoreRefundResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/wallet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WalletBalanceDto"];
                        "text/json": components["schemas"]["WalletBalanceDto"];
                        "text/plain": components["schemas"]["WalletBalanceDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/game/wallet/dev-grant": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["DevGrantRequest"];
                    "application/json": components["schemas"]["DevGrantRequest"];
                    "text/json": components["schemas"]["DevGrantRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WalletBalanceDto"];
                        "text/json": components["schemas"]["WalletBalanceDto"];
                        "text/plain": components["schemas"]["WalletBalanceDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["GetLiveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["GetReadiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MatchPage"];
                        "text/json": components["schemas"]["MatchPage"];
                        "text/plain": components["schemas"]["MatchPage"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/notices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MatchNotification"][];
                        "text/json": components["schemas"]["MatchNotification"][];
                        "text/plain": components["schemas"]["MatchNotification"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/requests": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LikeRequestSummary"][];
                        "text/json": components["schemas"]["LikeRequestSummary"][];
                        "text/plain": components["schemas"]["LikeRequestSummary"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/views/viewed-you": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ProfileViewSummary"][];
                        "text/json": components["schemas"]["ProfileViewSummary"][];
                        "text/plain": components["schemas"]["ProfileViewSummary"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/views/you-viewed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ProfileViewSummary"][];
                        "text/json": components["schemas"]["ProfileViewSummary"][];
                        "text/plain": components["schemas"]["ProfileViewSummary"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/views/{targetId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    targetId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/{match}/acknowledge": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    match: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/matches/{match}/unlock": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    match: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["UnlockMatchConversationRequest"];
                    "application/json": components["schemas"]["UnlockMatchConversationRequest"];
                    "text/json": components["schemas"]["UnlockMatchConversationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UnlockMatchConversationResult"];
                        "text/json": components["schemas"]["UnlockMatchConversationResult"];
                        "text/plain": components["schemas"]["UnlockMatchConversationResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    before?: number | string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuditDto"][];
                        "text/json": components["schemas"]["AuditDto"][];
                        "text/plain": components["schemas"]["AuditDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/csrf": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/game-questions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameQuestionDto"][];
                        "text/json": components["schemas"]["GameQuestionDto"][];
                        "text/plain": components["schemas"]["GameQuestionDto"][];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["CreateQuestionRequest"];
                    "application/json": components["schemas"]["CreateQuestionRequest"];
                    "text/json": components["schemas"]["CreateQuestionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameQuestionDto"];
                        "text/json": components["schemas"]["GameQuestionDto"];
                        "text/plain": components["schemas"]["GameQuestionDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/game-questions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["UpdateQuestionRequest"];
                    "application/json": components["schemas"]["UpdateQuestionRequest"];
                    "text/json": components["schemas"]["UpdateQuestionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GameQuestionDto"];
                        "text/json": components["schemas"]["GameQuestionDto"];
                        "text/plain": components["schemas"]["GameQuestionDto"];
                    };
                };
            };
        };
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["AdminLogin"];
                    "application/json": components["schemas"]["AdminLogin"];
                    "text/json": components["schemas"]["AdminLogin"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminIdentity"];
                        "text/json": components["schemas"]["AdminIdentity"];
                        "text/plain": components["schemas"]["AdminIdentity"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/photos": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    after?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PhotoReview"][];
                        "text/json": components["schemas"]["PhotoReview"][];
                        "text/plain": components["schemas"]["PhotoReview"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/photos/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ReviewRequest"];
                    "application/json": components["schemas"]["ReviewRequest"];
                    "text/json": components["schemas"]["ReviewRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/photos/{id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/profiles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    search?: string;
                    page?: number | string;
                    pageSize?: number | string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminProfileSummary"][];
                        "text/json": components["schemas"]["AdminProfileSummary"][];
                        "text/plain": components["schemas"]["AdminProfileSummary"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/profiles/photos/{id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/profiles/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminProfileDetail"];
                        "text/json": components["schemas"]["AdminProfileDetail"];
                        "text/plain": components["schemas"]["AdminProfileDetail"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/reports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    after?: string;
                    closed?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReportSummary"][];
                        "text/json": components["schemas"]["ReportSummary"][];
                        "text/plain": components["schemas"]["ReportSummary"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/reports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ReviewRequest"];
                    "application/json": components["schemas"]["ReviewRequest"];
                    "text/json": components["schemas"]["ReviewRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/reports/{id}/evidence": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JsonElement"];
                        "text/json": components["schemas"]["JsonElement"];
                        "text/plain": components["schemas"]["JsonElement"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/moderation/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UserReview"];
                        "text/json": components["schemas"]["UserReview"];
                        "text/plain": components["schemas"]["UserReview"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["AccountReview"];
                    "application/json": components["schemas"]["AccountReview"];
                    "text/json": components["schemas"]["AccountReview"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete: {
            parameters: {
                query?: {
                    reason?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/configuration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PushConfiguration"];
                        "text/json": components["schemas"]["PushConfiguration"];
                        "text/plain": components["schemas"]["PushConfiguration"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/device": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["DeviceRequest"];
                    "application/json": components["schemas"]["DeviceRequest"];
                    "text/json": components["schemas"]["DeviceRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PushPreferences"];
                        "text/json": components["schemas"]["PushPreferences"];
                        "text/plain": components["schemas"]["PushPreferences"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["PushPreferences"];
                    "application/json": components["schemas"]["PushPreferences"];
                    "text/json": components["schemas"]["PushPreferences"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/notifications/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ResolveNotification"];
                    "application/json": components["schemas"]["ResolveNotification"];
                    "text/json": components["schemas"]["ResolveNotification"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NotificationTarget"];
                        "text/json": components["schemas"]["NotificationTarget"];
                        "text/plain": components["schemas"]["NotificationTarget"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/payments/telegram-stars/invoice": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["TelegramStarsInvoiceRequest"];
                    "application/json": components["schemas"]["TelegramStarsInvoiceRequest"];
                    "text/json": components["schemas"]["TelegramStarsInvoiceRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TelegramStarsInvoiceResponse"];
                        "text/json": components["schemas"]["TelegramStarsInvoiceResponse"];
                        "text/plain": components["schemas"]["TelegramStarsInvoiceResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/payments/telegram-stars/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["TelegramStarsVerifyRequest"];
                    "application/json": components["schemas"]["TelegramStarsVerifyRequest"];
                    "text/json": components["schemas"]["TelegramStarsVerifyRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TelegramStarsVerifyResponse"];
                        "text/json": components["schemas"]["TelegramStarsVerifyResponse"];
                        "text/plain": components["schemas"]["TelegramStarsVerifyResponse"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/payments/telegram-stars/webhook": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["TelegramUpdate"];
                    "application/json": components["schemas"]["TelegramUpdate"];
                    "text/json": components["schemas"]["TelegramUpdate"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TelegramWebhookResult"];
                        "text/json": components["schemas"]["TelegramWebhookResult"];
                        "text/plain": components["schemas"]["TelegramWebhookResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/premium/packages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PremiumPackageDto"][];
                        "text/json": components["schemas"]["PremiumPackageDto"][];
                        "text/plain": components["schemas"]["PremiumPackageDto"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/premium/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PremiumStatusDto"];
                        "text/json": components["schemas"]["PremiumStatusDto"];
                        "text/plain": components["schemas"]["PremiumStatusDto"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/premium/subscribe": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SubscribePackageRequest"];
                    "application/json": components["schemas"]["SubscribePackageRequest"];
                    "text/json": components["schemas"]["SubscribePackageRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SubscribeResultDto"];
                        "text/json": components["schemas"]["SubscribeResultDto"];
                        "text/plain": components["schemas"]["SubscribeResultDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OwnProfileDto"];
                        "text/json": components["schemas"]["OwnProfileDto"];
                        "text/plain": components["schemas"]["OwnProfileDto"];
                    };
                };
            };
        };
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ProfileUpdate"];
                    "application/json": components["schemas"]["ProfileUpdate"];
                    "text/json": components["schemas"]["ProfileUpdate"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OwnProfileDto"];
                        "text/json": components["schemas"]["OwnProfileDto"];
                        "text/plain": components["schemas"]["OwnProfileDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/choices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ProfileChoices"];
                        "text/json": components["schemas"]["ProfileChoices"];
                        "text/plain": components["schemas"]["ProfileChoices"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/photos/reorder": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["ReorderRequest"];
                    "application/json": components["schemas"]["ReorderRequest"];
                    "text/json": components["schemas"]["ReorderRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OwnProfileDto"];
                        "text/json": components["schemas"]["OwnProfileDto"];
                        "text/plain": components["schemas"]["OwnProfileDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/photos/uploads": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["UploadRequest"];
                    "application/json": components["schemas"]["UploadRequest"];
                    "text/json": components["schemas"]["UploadRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PhotoDto"];
                        "text/json": components["schemas"]["PhotoDto"];
                        "text/plain": components["schemas"]["PhotoDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/photos/{photoId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    photoId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/photos/{photoId}/access": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    photoId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MediaGrant"];
                        "text/json": components["schemas"]["MediaGrant"];
                        "text/plain": components["schemas"]["MediaGrant"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/photos/{photoId}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    ticket?: string;
                    thumbnail?: boolean;
                };
                header?: never;
                path: {
                    photoId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/profile/photos/{photoId}/finalize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    photoId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PhotoDto"];
                        "text/json": components["schemas"]["PhotoDto"];
                        "text/plain": components["schemas"]["PhotoDto"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/safety": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SafetyRequest"];
                    "application/json": components["schemas"]["SafetyRequest"];
                    "text/json": components["schemas"]["SafetyRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/safety/blocks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SafetyPage"];
                        "text/json": components["schemas"]["SafetyPage"];
                        "text/plain": components["schemas"]["SafetyPage"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/safety/prior-conversations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: {
                    cursor?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SafetyPage"];
                        "text/json": components["schemas"]["SafetyPage"];
                        "text/plain": components["schemas"]["SafetyPage"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/swipes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SwipeRequest"];
                    "application/json": components["schemas"]["SwipeRequest"];
                    "text/json": components["schemas"]["SwipeRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SwipeResult"];
                        "text/json": components["schemas"]["SwipeResult"];
                        "text/plain": components["schemas"]["SwipeResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/swipes/superlike": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/*+json": components["schemas"]["SuperLikeRequest"];
                    "application/json": components["schemas"]["SuperLikeRequest"];
                    "text/json": components["schemas"]["SuperLikeRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SuperLikeResult"];
                        "text/json": components["schemas"]["SuperLikeResult"];
                        "text/plain": components["schemas"]["SuperLikeResult"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/swipes/{request}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    request: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SwipeResult"];
                        "text/json": components["schemas"]["SwipeResult"];
                        "text/plain": components["schemas"]["SwipeResult"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        AcceptedResponse: {
            /** @default If the request is eligible, an email will be sent. */
            message: string;
        };
        AccountResponse: {
            /** Format: uuid */
            id: string;
        };
        AccountReview: {
            active: boolean;
            reason: string;
        };
        AdminIdentity: {
            /** Format: uuid */
            id: string;
            role: string;
        };
        AdminLogin: {
            code?: null | string;
            email: string;
            password: string;
        };
        AdminPhotoDto: {
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** Format: int32 */
            position: number | string;
            state: string;
        };
        AdminProfileDetail: {
            active: boolean;
            /** Format: int32 */
            age: number | string;
            bio: string;
            city: string;
            cityKey: string;
            /** Format: date */
            dateOfBirth: string;
            desiredGenders: string[];
            displayName: string;
            email: string;
            emailConfirmed: boolean;
            gender: string;
            interests: string[];
            languages: string[];
            locationMode: string;
            /** Format: int32 */
            maxAge: number | string;
            /** Format: int32 */
            minAge: number | string;
            photos: components["schemas"]["AdminPhotoDto"][];
            /** Format: int32 */
            radiusKm: number | string;
            relationshipGoal: string;
            /** Format: int64 */
            revision: number | string;
            /** Format: uuid */
            userId: string;
            visible: boolean;
        };
        AdminProfileSummary: {
            active: boolean;
            /** Format: int32 */
            age: number | string;
            city: string;
            displayName: string;
            email: string;
            emailConfirmed: boolean;
            gender: string;
            /** Format: int32 */
            photoCount: number | string;
            /** Format: uuid */
            primaryPhotoId: null | string;
            /** Format: uuid */
            userId: string;
            visible: boolean;
        };
        AnswerQuestionRequest: {
            idempotencyKey: string;
            isSkipped: boolean;
            /** Format: uuid */
            questionId: string;
            /** Format: int32 */
            selectedOption: null | number | string;
            /** Format: int32 */
            stateVersion: number | string;
        };
        AnswerQuestionResult: {
            /** Format: int32 */
            questionIndex: number | string;
            revealed: boolean;
            revealedSelection: null | components["schemas"]["RevealedSelectionDto"];
            /** Format: uuid */
            roundId: string;
            submitted: boolean;
            waitingForPartner: boolean;
        };
        AuditDto: {
            action: string;
            /** Format: uuid */
            actorId: string;
            /** Format: date-time */
            at: string;
            /** Format: int64 */
            id: number | string;
            reason: string;
            /** Format: uuid */
            targetId: string;
        };
        ConfirmPublicDeletionRequest: {
            email: string;
            token: string;
        };
        CreateQuestionRequest: {
            category: string;
            options: string[];
            questionText: string;
        };
        CreateRoomRequest: {
            /**
             * Format: int32
             * @default 10
             */
            capacity: number | string;
            title?: null | string;
        };
        CrystalTransactionDto: {
            /** Format: int32 */
            amount: number | string;
            /** Format: int32 */
            balanceAfter: number | string;
            /** Format: date-time */
            createdAtUtc: string;
            description: null | string;
            /** Format: uuid */
            id: string;
            referenceId: null | string;
            type: string;
        };
        DeleteAccountRequest: {
            password: string;
        };
        DeletionStatusResponse: {
            /** Format: date-time */
            completedAt: null | string;
            /** Format: date-time */
            requestedAt: string;
            status: string;
            /** Format: uuid */
            userId: string;
        };
        DevFixtureSeedRequest: {
            /**
             * Format: int32
             * @default 3
             */
            femaleCount: number | string;
            /**
             * Format: int32
             * @default 3
             */
            maleCount: number | string;
        };
        DevGrantRequest: {
            /** Format: int32 */
            amount: number | string;
            idempotencyKey: string;
        };
        DeviceRequest: {
            enabled: boolean;
            /** Format: uuid */
            installationId: string;
            platform: string;
            projectId: string;
            provider: string;
            /** Format: int32 */
            revision: number | string;
            secret: string;
            token: null | string;
        };
        DirectMatchRequestDto: {
            /** Format: date-time */
            createdAtUtc: string;
            message: string;
            /** Format: uuid */
            requestId: string;
            /** Format: int32 */
            senderAge: number | string;
            senderDisplayName: string;
            senderPhoto: null | components["schemas"]["PhotoDto"];
            /** Format: uuid */
            senderUserId: string;
        };
        DiscoverabilityPauseRequest: {
            paused: boolean;
        };
        DiscoveryCard: {
            /** Format: int32 */
            age: number | string;
            bio: string;
            city: string;
            displayName: string;
            distanceBucket: null | string;
            gender: string;
            /** Format: uuid */
            id: string;
            interests: string[];
            languages?: null | string[];
            photos: components["schemas"]["PhotoDto"][];
            relationshipGoal: string;
        };
        DiscoveryPage: {
            items: components["schemas"]["DiscoveryCard"][];
            nextCursor: null | string;
        };
        DiscoverySettings: {
            city: string;
            desiredGenders: string[];
            hasLocation: boolean;
            /** Format: int32 */
            maxAge: number | string;
            /** Format: int32 */
            minAge: number | string;
            mode: string;
            /** Format: int32 */
            radiusKm: number | string;
            /** Format: int64 */
            revision: number | string;
        };
        EmailRequest: {
            email: string;
        };
        FrozenQuestionDto: {
            category: string;
            /** Format: uuid */
            id: string;
            options: string[];
            questionText: string;
        };
        GameGiftEventDto: {
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: int32 */
            crystalCost: number | string;
            giftIcon: string;
            giftId: string;
            giftName: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            recipientUserId: string;
            /** Format: uuid */
            senderUserId: string;
        };
        GameMemberDto: {
            /** Format: int32 */
            age: number | string;
            displayName: string;
            gender: string;
            /**
             * Format: int32
             * @default 1
             */
            generation: number | string;
            /** @default false */
            isSelf: boolean;
            /** Format: date-time */
            joinedAtUtc: string;
            photo: null | components["schemas"]["PhotoDto"];
            /** Format: int32 */
            reservationRemainingSeconds?: null | number | string;
            /** @default Active */
            status: string;
            /** Format: uuid */
            userId: string;
        };
        GameProfileDto: {
            /** Format: int32 */
            age: number | string;
            bio: string;
            city: string;
            displayName: string;
            gender: string;
            /** Format: int32 */
            giftsReceivedCount?: null | number | string;
            interests: string[];
            isFullAccess: boolean;
            /** Format: int32 */
            kissesReceivedCount?: null | number | string;
            photos: components["schemas"]["PhotoDto"][];
            relationshipGoal: string;
            /**
             * Format: int32
             * @default 25
             */
            unlockPrice: number | string;
            /** Format: uuid */
            userId: string;
        };
        GameProfileViewNoticeDto: {
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: uuid */
            id: string;
            seen: boolean;
            viewerDisplayName: string;
            /** Format: uuid */
            viewerUserId: string;
        };
        GameQuestionDto: {
            category: string;
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: uuid */
            id: string;
            isActive: boolean;
            options: string[];
            questionText: string;
            /** Format: int32 */
            version: number | string;
        };
        GameRoomDetail: {
            canStart: boolean;
            /** Format: int32 */
            capacity: number | string;
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: int32 */
            femaleCount: number | string;
            /** Format: int32 */
            femaleQuota: number | string;
            /** Format: uuid */
            id: string;
            isJoined: boolean;
            /** Format: date-time */
            lobbyDeadlineUtc: string;
            /** Format: int32 */
            maleCount: number | string;
            /** Format: int32 */
            maleQuota: number | string;
            /** Format: int32 */
            memberCount: number | string;
            members: components["schemas"]["GameMemberDto"][];
            /** Format: int32 */
            minFemaleStart: number | string;
            /** Format: int32 */
            minMaleStart: number | string;
            state: string;
            title: string;
            /** Format: int32 */
            version: number | string;
        };
        GameRoomMessageDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            roomId: string;
            senderDisplayName: string;
            senderPhotoId: null | string;
            /** Format: uuid */
            senderUserId: string;
            /** Format: date-time */
            sentAtUtc: string;
            text: string;
        };
        GameRoomSnapshot: {
            /** Format: int32 */
            capacity: number | string;
            currentRound?: null | components["schemas"]["GameRoundDto"];
            /** Format: uuid */
            currentTurnUserId?: null | string;
            deadlineType: null | string;
            /** Format: date-time */
            deadlineUtc: null | string;
            /** Format: int32 */
            disconnectPauseBudgetMs: number | string;
            /** Format: int32 */
            femaleCount: number | string;
            /** Format: int32 */
            femaleQuota: number | string;
            isPaused: boolean;
            /** Format: int32 */
            maleCount: number | string;
            /** Format: int32 */
            maleQuota: number | string;
            /** Format: int32 */
            memberCount: number | string;
            members: components["schemas"]["GameMemberDto"][];
            /** Format: int32 */
            minActivePlayers: number | string;
            pendingDirectRequests?: null | components["schemas"]["DirectMatchRequestDto"][];
            recentGifts?: null | components["schemas"]["GameGiftEventDto"][];
            /** Format: int32 */
            remainingDeadlineMs: null | number | string;
            /** Format: uuid */
            roomId: string;
            sentDirectRequestUserIds?: null | string[];
            /** Format: int64 */
            sequence: number | string;
            /** Format: date-time */
            serverTimeUtc: string;
            state: string;
            /** Format: int32 */
            stateVersion: number | string;
            title: string;
        };
        GameRoomSummary: {
            /** Format: int32 */
            capacity: number | string;
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: int32 */
            femaleCount: number | string;
            /** Format: int32 */
            femaleQuota: number | string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            lobbyDeadlineUtc: string;
            /** Format: int32 */
            maleCount: number | string;
            /** Format: int32 */
            maleQuota: number | string;
            /** Format: int32 */
            memberCount: number | string;
            state: string;
            title: string;
            /** Format: int32 */
            version: number | string;
        };
        GameRoundDto: {
            /** Format: int32 */
            angleDegrees: number | string;
            /** Format: int32 */
            callerPendingAnswer: null | number | string;
            currentQuestion: null | components["schemas"]["FrozenQuestionDto"];
            /** Format: int32 */
            currentQuestionIndex: number | string;
            deadlineType: null | string;
            /** Format: date-time */
            deadlineUtc: null | string;
            /** @default false */
            hasPendingKissFromPartner: boolean;
            /** Format: uuid */
            kissRecipientUserId?: null | string;
            /** @default false */
            kissSkipped: boolean;
            revealedSelections: components["schemas"]["RevealedSelectionDto"][];
            /** Format: uuid */
            roundId: string;
            /** Format: int32 */
            roundNumber: number | string;
            /** Format: uuid */
            spinnerUserId: string;
            state: string;
            summaryCommentary?: null | string;
            /** Format: uuid */
            targetUserId: string;
        };
        GiftCatalogItemDto: {
            icon: string;
            id: string;
            name: string;
            /** Format: int32 */
            price: number | string;
        };
        GiftItemDto: {
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: int32 */
            crystalCost: number | string;
            giftIcon: string;
            giftId: string;
            giftName: string;
            /** Format: uuid */
            id: string;
            otherDisplayName: string;
            otherPhoto: null | components["schemas"]["PhotoDto"];
            /** Format: uuid */
            otherUserId: string;
        };
        HealthResponse: {
            status: string;
        };
        HeartbeatResult: {
            /** Format: uuid */
            roomId: string;
            /** Format: date-time */
            serverTimeUtc: string;
        };
        HistoryPage: {
            items: components["schemas"]["MessageDto"][];
            nextAfter: null | string;
            nextBefore: null | string;
            peerReadSequence: string;
            readSequence: string;
        };
        JoinQueueRequest: {
            /**
             * Format: int32
             * @default 10
             */
            capacity: number | string;
        };
        JoinRoomResult: {
            /** Format: uuid */
            membershipId: string;
            /** Format: uuid */
            roomId: string;
            state: string;
            /** Format: int32 */
            version: number | string;
        };
        JsonElement: unknown;
        LeaveRoomResult: {
            /** Format: uuid */
            roomId: string;
            success: boolean;
        };
        LikeRequestSummary: {
            /** Format: int32 */
            age: number | string;
            bio: string;
            city: string;
            displayName: string;
            /** @default  */
            gender: string;
            interests?: null | string[];
            /** @default false */
            isBlurred: boolean;
            note?: null | string;
            /** @default Discovery */
            origin: string;
            photo: null | components["schemas"]["PhotoDto"];
            photos?: null | components["schemas"]["PhotoDto"][];
            /** @default  */
            relationshipGoal: string;
            /** Format: uuid */
            userId: string;
        };
        LocationRequest: {
            consent: boolean;
            /** Format: double */
            latitude: number | string;
            /** Format: double */
            longitude: number | string;
        };
        LoginRequest: {
            email: string;
            password: string;
        };
        LogoutRequest: {
            refreshToken: string;
        };
        MatchNotification: {
            /** Format: uuid */
            eventId: string;
            /** Format: uuid */
            matchId: string;
        };
        MatchPage: {
            items: components["schemas"]["MatchSummary"][];
            /** Format: uuid */
            nextCursor: null | string;
        };
        MatchSummary: {
            /** Format: int32 */
            age: number | string;
            /** @default  */
            bio: string;
            city: string;
            /** Format: uuid */
            conversationId: string;
            displayName: string;
            /** @default  */
            gender: string;
            /** @default true */
            hasChatEntitlement: boolean;
            /** Format: uuid */
            id: string;
            interests?: null | string[];
            lastMessage: null | string;
            /** @default Discovery */
            origin: string;
            photo?: null | components["schemas"]["PhotoDto"];
            photos?: null | components["schemas"]["PhotoDto"][];
            /** @default  */
            relationshipGoal: string;
            /** Format: int32 */
            unreadCount: number | string;
            /** Format: uuid */
            userId?: null | string;
        };
        MediaGrant: {
            /** Format: date-time */
            expiresAt: string;
            ticket: string;
        };
        MessageDto: {
            /** Format: uuid */
            clientMessageId: string;
            /** Format: uuid */
            conversationId: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            senderId: string;
            /** Format: date-time */
            sentAt: string;
            sequence: string;
            text: string;
        };
        NotificationTarget: {
            /** Format: uuid */
            conversationId: string;
        };
        OtpSendRequest: {
            email: string;
        };
        OtpSendResponse: {
            /** @default 1111 */
            devCode: null | string;
            message: string;
        };
        OtpVerifyRequest: {
            code: string;
            email: string;
        };
        OtpVerifyResponse: {
            hasCompleteProfile: boolean;
            isNewUser: boolean;
            tokens: components["schemas"]["TokenResponse"];
        };
        OwnProfileDto: {
            /** Format: int32 */
            age: number | string;
            bio: string;
            city: string;
            complete: boolean;
            desiredGenders: string[];
            displayName: string;
            gender: string;
            interests: string[];
            languages?: null | string[];
            photos: components["schemas"]["PhotoDto"][];
            relationshipGoal: string;
            /** Format: int64 */
            revision: number | string;
            visible: boolean;
        };
        PhotoDto: {
            /** Format: int32 */
            height: number | string;
            /** Format: uuid */
            id: string;
            /** Format: int32 */
            position: number | string;
            state: string;
            /** Format: int32 */
            width: number | string;
        };
        PhotoReview: {
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            userId: string;
        };
        PostGameKissRequest: {
            idempotencyKey: string;
            /** Format: uuid */
            recipientUserId: string;
        };
        PostGameKissResult: {
            /** Format: uuid */
            conversationId?: null | string;
            isMatch: boolean;
            /** Format: uuid */
            kissId: string;
            /** Format: uuid */
            matchId?: null | string;
            /** Format: uuid */
            recipientUserId: string;
            /** Format: uuid */
            senderUserId: string;
            status: string;
        };
        PremiumPackageDto: {
            badge?: null | string;
            currency: string;
            description: string;
            /** Format: int32 */
            durationDays: null | number | string;
            id: string;
            /** @default false */
            isPopular: boolean;
            name: string;
            /** Format: double */
            priceAmount: number | string;
            priceDisplay: string;
        };
        PremiumStatusDto: {
            activePackageId: null | string;
            /** Format: date-time */
            expiresAtUtc: null | string;
            hasPremium: boolean;
            isLifetime: boolean;
            packages: components["schemas"]["PremiumPackageDto"][];
        };
        ProblemDetails: {
            detail?: null | string;
            instance?: null | string;
            /** Format: int32 */
            status?: null | number | string;
            title?: null | string;
            type?: null | string;
        };
        ProfileChoices: {
            genders: string[];
            interests: string[];
            languages: string[];
            relationshipGoals: string[];
        };
        ProfileUpdate: {
            bio: null | string;
            city: null | string;
            /** Format: date */
            dateOfBirth?: null | string;
            desiredGenders: null | string[];
            displayName: string;
            gender: string;
            interests: null | string[];
            languages?: null | string[];
            relationshipGoal: null | string;
            /** Format: int64 */
            revision: number | string;
            visible: boolean;
        };
        ProfileViewSummary: {
            /** Format: int32 */
            age: number | string;
            bio: string;
            city: string;
            displayName: string;
            /** @default  */
            gender: string;
            interests?: null | string[];
            photo?: null | components["schemas"]["PhotoDto"];
            photos?: null | components["schemas"]["PhotoDto"][];
            /** @default  */
            relationshipGoal: string;
            /** Format: uuid */
            userId: string;
            /** Format: date-time */
            viewedAt: string;
        };
        PublicDeletionRequest: {
            email: string;
        };
        PushConfiguration: {
            enabled: boolean;
            projectId: null | string;
        };
        PushPreferences: {
            matches: boolean;
            messages: boolean;
        };
        ReadDto: {
            sequence: string;
        };
        ReadMessage: {
            /** Format: uuid */
            messageId: string;
        };
        ReconnectRoomResult: {
            /** Format: int32 */
            generation: number | string;
            /** Format: uuid */
            membershipId: string;
            /** Format: uuid */
            roomId: string;
            snapshot: components["schemas"]["GameRoomSnapshot"];
        };
        RefreshRequest: {
            refreshToken: string;
            /** Format: uuid */
            requestId: string;
        };
        RegisterRequest: {
            /** Format: date */
            dateOfBirth: string;
            email: string;
            password: string;
        };
        ReorderRequest: {
            photoIds: string[];
            /** Format: int64 */
            revision: number | string;
        };
        ReportInput: {
            category: string;
            description: string;
            kind: string;
            /** Format: uuid */
            messageId?: null | string;
        };
        ReportSummary: {
            category: string;
            closed: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            subjectId: string;
        };
        ResetRequest: {
            code: string;
            email: string;
            password: string;
        };
        ResolveNotification: {
            /** Format: uuid */
            notificationId: string;
        };
        RespondDirectMatchRequestInput: {
            action: string;
        };
        RespondDirectMatchRequestResult: {
            /** Format: uuid */
            conversationId?: null | string;
            /** Format: uuid */
            matchId?: null | string;
            /** Format: uuid */
            requestId: string;
            status: string;
        };
        RevealedSelectionDto: {
            fallbackCommentary: string;
            isMatch: boolean;
            isSuppressed: boolean;
            /** Format: int32 */
            questionIndex: number | string;
            /** Format: int32 */
            spinnerOption: null | number | string;
            /** Format: int32 */
            targetOption: null | number | string;
        };
        ReviewRequest: {
            reason: string;
            state: string;
        };
        SafetyItem: {
            /** Format: date-time */
            createdAt: null | string;
            /** Format: uuid */
            id: string;
        };
        SafetyPage: {
            items: components["schemas"]["SafetyItem"][];
            /** Format: uuid */
            nextCursor: null | string;
        };
        SafetyRequest: {
            action: string;
            /** Format: uuid */
            conversationId?: null | string;
            report?: null | components["schemas"]["ReportInput"];
            /** Format: uuid */
            requestId: string;
            /** Format: uuid */
            targetId?: null | string;
        };
        SelectTargetRequest: {
            /** Format: uuid */
            targetUserId: string;
        };
        SelectTargetResult: {
            currentQuestion: components["schemas"]["FrozenQuestionDto"];
            /** Format: date-time */
            deadlineUtc: string;
            /** Format: uuid */
            roundId: string;
            /** Format: uuid */
            spinnerUserId: string;
            /** Format: uuid */
            targetUserId: string;
        };
        SendDirectMatchRequestInput: {
            idempotencyKey: string;
            message: string;
            /** Format: uuid */
            roomId?: null | string;
            /** Format: uuid */
            targetUserId: string;
        };
        SendDirectMatchRequestResult: {
            /** Format: int32 */
            balanceAfter: number | string;
            /** Format: date-time */
            createdAtUtc: string;
            /** Format: int32 */
            crystalsPaid: number | string;
            /** Format: uuid */
            requestId: string;
            status: string;
            /** Format: uuid */
            targetUserId: string;
        };
        SendGiftRequest: {
            giftId: string;
            idempotencyKey: string;
            /** Format: uuid */
            recipientUserId: string;
            /** Format: uuid */
            roomId: null | string;
        };
        SendGiftResult: {
            /** Format: int32 */
            balance: number | string;
            /** Format: int32 */
            crystalCost: number | string;
            giftIcon: string;
            giftId: string;
            giftName: string;
            /** Format: uuid */
            giftRecordId: string;
            message: string;
            recipientDisplayName: string;
            success: boolean;
        };
        SendKissRequest: {
            idempotencyKey: string;
            /** Format: uuid */
            recipientUserId: string;
        };
        SendKissResult: {
            /** Format: uuid */
            conversationId?: null | string;
            /** Format: uuid */
            kissId: string;
            /** Format: uuid */
            matchId?: null | string;
            /** Format: uuid */
            recipientUserId: string;
            /** Format: uuid */
            senderUserId: string;
            status: string;
        };
        SendMessage: {
            /** Format: uuid */
            clientMessageId: string;
            text: string;
        };
        SendRoomMessageRequest: {
            text: string;
        };
        SettingsRequest: {
            city: string;
            desiredGenders: string[];
            /** Format: int32 */
            maxAge: number | string;
            /** Format: int32 */
            minAge: number | string;
            mode: string;
            /** Format: int32 */
            radiusKm: number | string;
            /** Format: int64 */
            revision: number | string;
        };
        SkipKissRequest: {
            idempotencyKey: string;
        };
        SkipQuestionRequest: {
            idempotencyKey: string;
        };
        SkipTargetRequest: {
            idempotencyKey?: null | string;
        };
        SpinRequest: {
            autoPickTarget?: null | boolean;
        };
        SpinResult: {
            /** Format: int32 */
            angleDegrees: number | string;
            /** Format: date-time */
            deadlineUtc: string;
            /** Format: uuid */
            roundId: string;
            /** Format: int32 */
            spinDurationMs: number | string;
            /** Format: uuid */
            spinnerUserId: string;
            /** Format: uuid */
            targetUserId: string;
        };
        StoreProductDto: {
            /** Format: int32 */
            crystalAmount: number | string;
            description: string;
            productId: string;
            tierApproximateGEL: string;
            title: string;
        };
        StorePurchaseRequest: {
            currency?: null | string;
            platform: string;
            /** Format: double */
            price?: null | number | string;
            productId: string;
            purchaseToken: string;
            transactionId: string;
        };
        StorePurchaseResult: {
            alreadyProcessed: boolean;
            /** Format: int32 */
            balance: number | string;
            /** Format: int32 */
            crystalsCredited: number | string;
            /** Format: int32 */
            debtRepaid: number | string;
            message: string;
            /** Format: int32 */
            outstandingDebt: number | string;
            success: boolean;
        };
        StoreRefundRequest: {
            platform: string;
            reason?: null | string;
            refundId: string;
            transactionId: string;
        };
        StoreRefundResult: {
            alreadyProcessed: boolean;
            /** Format: int32 */
            balance: number | string;
            /** Format: int32 */
            crystalsRevoked: number | string;
            message: string;
            /** Format: int32 */
            outstandingDebt: number | string;
            success: boolean;
        };
        SubscribePackageRequest: {
            idempotencyKey?: null | string;
            packageId: string;
            /** @default mobile */
            platform: null | string;
            transactionId?: null | string;
        };
        SubscribeResultDto: {
            message: string;
            status: components["schemas"]["PremiumStatusDto"];
            success: boolean;
        };
        SuperLikeRequest: {
            note?: null | string;
            /** Format: uuid */
            requestId: string;
            /** Format: uuid */
            targetId: string;
        };
        SuperLikeResult: {
            /** Format: int32 */
            balanceAfter: number | string;
            /** Format: uuid */
            matchId: null | string;
            note: null | string;
            /** Format: uuid */
            requestId: string;
            /** Format: uuid */
            targetId: string;
        };
        SwipeRequest: {
            kind: string;
            /** Format: uuid */
            requestId: string;
            /** Format: uuid */
            targetId: string;
        };
        SwipeResult: {
            kind: string;
            /** Format: uuid */
            matchId: null | string;
            /** Format: uuid */
            requestId: string;
            /** Format: uuid */
            targetId: string;
        };
        TelegramAuthRequest: {
            initData: string;
        };
        TelegramPreCheckoutQuery: {
            /** @default XTR */
            currency: string;
            from?: null | components["schemas"]["TelegramWebhookUser"];
            /** @default  */
            id: string;
            /** @default  */
            invoice_payload: string;
            /**
             * Format: int32
             * @default 0
             */
            total_amount: number | string;
        };
        TelegramStarsInvoiceRequest: {
            itemId: string;
            itemType: string;
        };
        TelegramStarsInvoiceResponse: {
            invoiceLink: string;
            itemId: string;
            itemType: string;
            payload: string;
            /** Format: int32 */
            starsAmount: number | string;
        };
        TelegramStarsVerifyRequest: {
            payload: string;
            telegramPaymentChargeId?: null | string;
        };
        TelegramStarsVerifyResponse: {
            message: string;
            premiumStatus?: null | components["schemas"]["PremiumStatusDto"];
            success: boolean;
            /** Format: int32 */
            walletBalance?: null | number | string;
        };
        TelegramSuccessfulPayment: {
            /** @default XTR */
            currency: string;
            /** @default  */
            invoice_payload: string;
            provider_payment_charge_id?: null | string;
            /** @default  */
            telegram_payment_charge_id: string;
            /**
             * Format: int32
             * @default 0
             */
            total_amount: number | string;
        };
        TelegramUpdate: {
            message?: null | components["schemas"]["TelegramWebhookMessage"];
            pre_checkout_query?: null | components["schemas"]["TelegramPreCheckoutQuery"];
            /**
             * Format: int64
             * @default 0
             */
            update_id: number | string;
        };
        TelegramWebhookChat: {
            /**
             * Format: int64
             * @default 0
             */
            id: number | string;
            type?: null | string;
        };
        TelegramWebhookMessage: {
            chat?: null | components["schemas"]["TelegramWebhookChat"];
            from?: null | components["schemas"]["TelegramWebhookUser"];
            /**
             * Format: int64
             * @default 0
             */
            message_id: number | string;
            successful_payment?: null | components["schemas"]["TelegramSuccessfulPayment"];
            text?: null | string;
        };
        TelegramWebhookResult: {
            status: string;
            success: boolean;
        };
        TelegramWebhookUser: {
            first_name?: null | string;
            /**
             * Format: int64
             * @default 0
             */
            id: number | string;
            username?: null | string;
        };
        TokenResponse: {
            /** Format: date-time */
            accessExpiresAt: string;
            accessToken: string;
            account: components["schemas"]["AccountResponse"];
            refreshToken: string;
            /** Format: date-time */
            sessionExpiresAt: string;
        };
        UnlockMatchConversationRequest: {
            idempotencyKey: string;
        };
        UnlockMatchConversationResult: {
            alreadyOpen: boolean;
            /** Format: int32 */
            balance: number | string;
            /** Format: uuid */
            conversationId: string;
            /** Format: int32 */
            debited: number | string;
            /** Format: uuid */
            matchId: string;
            message: string;
            unlocked: boolean;
        };
        UnlockProfileRequest: {
            idempotencyKey: string;
        };
        UnlockProfileResult: {
            alreadyUnlocked: boolean;
            /** Format: int32 */
            balance: number | string;
            /** Format: int32 */
            debited: number | string;
            message: string;
            profile: null | components["schemas"]["GameProfileDto"];
            unlocked: boolean;
        };
        UpdateAiConsentRequest: {
            aiConsent: boolean;
        };
        UpdateQuestionRequest: {
            category: string;
            isActive: boolean;
            options: string[];
            questionText: string;
        };
        UploadRequest: {
            /** Format: uuid */
            requestId: string;
        };
        UserAiConsentResponse: {
            aiConsent: boolean;
            /** Format: date-time */
            consentGivenAtUtc: null | string;
            disclosureText: string;
        };
        UserGiftsDto: {
            receivedGifts: components["schemas"]["GiftItemDto"][];
            sentGifts: components["schemas"]["GiftItemDto"][];
            /** Format: int32 */
            totalReceivedCount: number | string;
            /** Format: int32 */
            totalReceivedCrystalsValue: number | string;
            /** Format: int32 */
            totalSentCount: number | string;
        };
        UserReview: {
            active: boolean;
            displayName: string;
            /** Format: uuid */
            id: string;
        };
        VerifyRequest: {
            code: string;
            email: string;
        };
        WalletBalanceDto: {
            /** Format: int32 */
            balance: number | string;
            /** Format: int32 */
            outstandingDebt: number | string;
            recentTransactions: components["schemas"]["CrystalTransactionDto"][];
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    GetLiveness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                    "text/json": components["schemas"]["HealthResponse"];
                    "text/plain": components["schemas"]["HealthResponse"];
                };
            };
        };
    };
    GetReadiness: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OK */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthResponse"];
                    "text/json": components["schemas"]["HealthResponse"];
                    "text/plain": components["schemas"]["HealthResponse"];
                };
            };
            /** @description Service Unavailable */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemDetails"];
                    "text/json": components["schemas"]["ProblemDetails"];
                    "text/plain": components["schemas"]["ProblemDetails"];
                };
            };
        };
    };
}
