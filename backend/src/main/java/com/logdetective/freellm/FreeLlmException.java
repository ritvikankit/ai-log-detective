package com.logdetective.freellm;

import org.springframework.http.HttpStatusCode;

public class FreeLlmException extends RuntimeException {

	private final HttpStatusCode status;

	public FreeLlmException(HttpStatusCode status, String clientMessage) {
		super(clientMessage);
		this.status = status;
	}

	public HttpStatusCode getStatus() {
		return status;
	}

}
