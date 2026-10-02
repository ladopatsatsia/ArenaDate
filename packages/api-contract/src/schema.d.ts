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
        delete?: never;
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
            code: string;
            email: string;
            password: string;
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
        HealthResponse: {
            status: string;
        };
        HistoryPage: {
            items: components["schemas"]["MessageDto"][];
            nextAfter: null | string;
            nextBefore: null | string;
            peerReadSequence: string;
            readSequence: string;
        };
        JsonElement: unknown;
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
            city: string;
            /** Format: uuid */
            conversationId: string;
            displayName: string;
            /** Format: uuid */
            id: string;
            lastMessage: null | string;
            /** Format: int32 */
            unreadCount: number | string;
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
            relationshipGoals: string[];
        };
        ProfileUpdate: {
            bio: string;
            city: string;
            desiredGenders: string[];
            displayName: string;
            gender: string;
            interests: string[];
            relationshipGoal: string;
            /** Format: int64 */
            revision: number | string;
            visible: boolean;
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
        SendMessage: {
            /** Format: uuid */
            clientMessageId: string;
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
        TokenResponse: {
            /** Format: date-time */
            accessExpiresAt: string;
            accessToken: string;
            account: components["schemas"]["AccountResponse"];
            refreshToken: string;
            /** Format: date-time */
            sessionExpiresAt: string;
        };
        UploadRequest: {
            /** Format: uuid */
            requestId: string;
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
